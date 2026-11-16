-- Réservation atomique de quota (formations classiques et analyses
-- approfondies), pour empêcher qu'une course condition entre plusieurs
-- requêtes simultanées ne permette de dépasser les limites Free/Pro.
-- À exécuter après 0006_deep_analyses.sql.
--
-- Fonctionnement : reserve_generation_slot() vérifie l'abonnement de
-- l'utilisateur, compte ses réservations actives (pending + completed) sur
-- la bonne fenêtre (à vie pour le gratuit, période de facturation en cours
-- pour le Pro), et insère une réservation "pending" si une place est
-- disponible — le tout verrouillé par un advisory lock transactionnel par
-- (utilisateur, type) pour que deux appels concurrents ne puissent jamais
-- lire le même compteur avant que l'un des deux n'ait inséré sa réservation.
-- resolve_generation_slot() marque ensuite cette réservation comme
-- "completed" (génération sauvegardée avec succès) ou "released" (échec),
-- en ne touchant jamais une réservation déjà résolue ni celle d'un autre
-- utilisateur. Les réservations "pending" plus vieilles que 15 minutes
-- (bien au-delà des 300s de maxDuration des deux routes de génération) sont
-- traitées comme abandonnées et libérées automatiquement au prochain appel.

create table if not exists public.generation_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('course', 'analysis')),
  status text not null default 'pending' check (status in ('pending', 'completed', 'released')),
  resource_id uuid,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists generation_reservations_user_kind_idx
  on public.generation_reservations (user_id, kind, status, created_at);

alter table public.generation_reservations enable row level security;

-- Lecture seule pour l'utilisateur (transparence/debug uniquement — rien
-- dans l'app n'affiche encore ces lignes). Toute écriture passe
-- exclusivement par les fonctions security definer ci-dessous : il n'existe
-- volontairement aucune policy insert/update/delete, donc le client ne peut
-- jamais réserver ou libérer une place directement.
drop policy if exists "generation_reservations_owner_select" on public.generation_reservations;
create policy "generation_reservations_owner_select"
  on public.generation_reservations
  for select
  using (auth.uid() = user_id);

-- Réserve atomiquement une place de génération pour l'utilisateur courant
-- (déterminé par auth.uid(), jamais par un paramètre — impossible de réserver
-- au nom de quelqu'un d'autre). Les limites Free/Pro sont fixées en dur
-- ci-dessous, côté SQL, et ne sont PAS des paramètres de la fonction : cette
-- fonction est accordée au rôle `authenticated`, donc appelable directement
-- depuis le navigateur (supabase.rpc(...)) avec le JWT de l'utilisateur — si
-- les limites étaient transmises par l'appelant, n'importe qui pourrait
-- contourner le quota en passant des valeurs arbitraires. Le statut
-- Pro/gratuit est toujours déterminé ici en lisant `subscriptions`, jamais
-- transmis par l'appelant. Ces constantes doivent rester synchronisées
-- manuellement avec src/lib/courses/plan.ts (TypeScript n'est pas importable
-- ici) : course free=1 (à vie) / pro=3 (mensuel) ; analysis free=0 / pro=2
-- (mensuel).
drop function if exists public.reserve_generation_slot(text, int, int);

create or replace function public.reserve_generation_slot(
  p_kind text
) returns table (
  ok boolean,
  reservation_id uuid,
  is_pro boolean,
  limit_count int,
  used_count int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_sub_status text;
  v_sub_period_start timestamptz;
  v_is_pro boolean := false;
  v_window_start timestamptz := '-infinity';
  v_limit int;
  v_used int;
  v_reservation_id uuid;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if p_kind not in ('course', 'analysis') then
    raise exception 'invalid_kind';
  end if;

  -- Sérialise les appels concurrents pour ce (utilisateur, type) : un
  -- deuxième appel simultané attend que le premier ait validé et commité sa
  -- réservation avant de recompter — élimine la course condition "lire 0,
  -- lire 0, insérer, insérer" entre deux requêtes parallèles.
  perform pg_advisory_xact_lock(hashtext(v_user_id::text), hashtext(p_kind));

  select s.status, s.current_period_start
    into v_sub_status, v_sub_period_start
  from public.subscriptions s
  where s.user_id = v_user_id;

  if found and v_sub_status in ('active', 'trialing') then
    v_is_pro := true;
    v_window_start := coalesce(v_sub_period_start, '-infinity'::timestamptz);
  else
    v_is_pro := false;
    v_window_start := '-infinity'::timestamptz;
  end if;

  -- Limites fixées en dur (voir le commentaire au-dessus de la fonction) :
  -- jamais transmises par l'appelant.
  v_limit := case
    when p_kind = 'course' and v_is_pro then 3
    when p_kind = 'course' and not v_is_pro then 1
    when p_kind = 'analysis' and v_is_pro then 2
    else 0
  end;

  -- Réservations abandonnées (requête interrompue, redémarrage serveur...) :
  -- au-delà d'un délai très supérieur à la durée max d'une génération, elles
  -- ne doivent plus jamais bloquer le quota.
  update public.generation_reservations
  set status = 'released', resolved_at = now()
  where user_id = v_user_id
    and kind = p_kind
    and status = 'pending'
    and created_at < now() - interval '15 minutes';

  select count(*) into v_used
  from public.generation_reservations
  where user_id = v_user_id
    and kind = p_kind
    and status in ('pending', 'completed')
    and created_at >= v_window_start;

  if v_used >= v_limit then
    return query select false, null::uuid, v_is_pro, v_limit, v_used;
    return;
  end if;

  insert into public.generation_reservations (user_id, kind, status)
  values (v_user_id, p_kind, 'pending')
  returning id into v_reservation_id;

  return query select true, v_reservation_id, v_is_pro, v_limit, v_used + 1;
end;
$$;

revoke all on function public.reserve_generation_slot(text) from public;
grant execute on function public.reserve_generation_slot(text) to authenticated;

-- Résout une réservation existante ('completed' si la génération a été
-- sauvegardée avec succès, 'released' sinon). Toujours scopé à
-- auth.uid() : impossible de résoudre la réservation d'un autre
-- utilisateur. Le `and status = 'pending'` dans le WHERE garantit qu'une
-- réservation déjà "completed" ne peut plus jamais être libérée, et qu'un
-- appel en double (ou sur un id inexistant) est un no-op sans erreur.
create or replace function public.resolve_generation_slot(
  p_reservation_id uuid,
  p_status text,
  p_resource_id uuid default null
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_updated int;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if p_status not in ('completed', 'released') then
    raise exception 'invalid_status';
  end if;

  update public.generation_reservations
  set status = p_status,
      resolved_at = now(),
      resource_id = coalesce(p_resource_id, resource_id)
  where id = p_reservation_id
    and user_id = v_user_id
    and status = 'pending';

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

revoke all on function public.resolve_generation_slot(uuid, text, uuid) from public;
grant execute on function public.resolve_generation_slot(uuid, text, uuid) to authenticated;
