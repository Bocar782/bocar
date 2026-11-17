-- Limite de fréquence sur le chat contextuel (Prompt 05.16.1, correctif E1
-- de l'audit de sécurité 05.16) : /api/chat déclenchait un appel Anthropic
-- payant par message, sans aucune limite côté serveur — seules la taille et
-- le nombre de messages par requête étaient bornés (voir chat/route.ts).
-- Un compte authentifié pouvait donc scripter un nombre illimité d'appels.
-- À exécuter après 0015_chapter_exercise.sql (déjà exécutée sur Supabase —
-- NE PAS la modifier ni la rejouer).
--
-- Choix d'architecture : `generation_reservations` (0007) a un cycle de vie
-- pending -> completed/released pensé pour une tâche longue et incertaine
-- (génération complète, qui peut échouer en cours de route et doit libérer
-- sa place). Un message de chat est une action unique, bornée, qui réussit
-- ou échoue immédiatement : il n'y a rien à "réserver puis libérer". Réutiliser
-- `generation_reservations` aurait demandé d'élargir sa contrainte `kind`
-- (en plus du fait qu'elle mélangerait deux fenêtres de quota très
-- différentes : "par mois, selon la période de facturation Stripe" pour les
-- générations, contre "par heure glissante / par jour glissant" ici) pour un
-- bénéfice nul. Une table et une fonction dédiées, plus simples, sont donc
-- préférables : chaque ligne de `chat_rate_limit_log` représente un appel
-- déjà accepté (compté au moment de la tentative, avant l'appel Anthropic —
-- comme `reserve_generation_slot`, jamais après coup : le coût est engagé dès
-- l'appel au modèle, qu'il aboutisse ou non côté client).
--
-- Limites (fixées en dur ci-dessous, jamais transmises par l'appelant — même
-- raisonnement que reserve_generation_slot en 0007) : à garder synchronisées
-- manuellement avec src/lib/chat/rate-limit.ts (TypeScript n'est pas
-- importable ici) :
--   - Plan gratuit : 15 messages / heure glissante, 40 messages / jour glissant.
--   - Plan Pro     : 50 messages / heure glissante, 150 messages / jour glissant.
-- Choisies pour laisser une vraie marge à un usage normal (plusieurs
-- questions par leçon, sur toute une session de lecture) tout en bornant
-- strictement le coût maximal par compte et par jour.

create table if not exists public.chat_rate_limit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists chat_rate_limit_log_user_id_created_at_idx
  on public.chat_rate_limit_log (user_id, created_at desc);

alter table public.chat_rate_limit_log enable row level security;

-- Lecture seule pour l'utilisateur (transparence/debug, comme
-- generation_reservations) — aucune policy insert/update/delete : toute
-- écriture passe exclusivement par la fonction security definer ci-dessous,
-- donc impossible d'enregistrer, modifier ou supprimer une ligne
-- directement, pour soi-même ou pour quelqu'un d'autre.
drop policy if exists "chat_rate_limit_log_owner_select" on public.chat_rate_limit_log;
create policy "chat_rate_limit_log_owner_select"
  on public.chat_rate_limit_log
  for select
  using (auth.uid() = user_id);

-- Vérifie ET enregistre atomiquement une tentative d'appel au chat pour
-- l'utilisateur courant (déterminé par auth.uid(), jamais par un paramètre —
-- impossible de consommer le quota de quelqu'un d'autre ni de se faire
-- passer pour un autre plan). Le statut Pro/gratuit est toujours déterminé
-- ici en lisant `subscriptions`, jamais transmis par l'appelant : un plan
-- falsifié côté navigateur n'a donc aucun effet. Verrouillage par advisory
-- lock transactionnel (même mécanisme que reserve_generation_slot, 0007) :
-- deux appels concurrents pour le même utilisateur ne peuvent jamais lire le
-- même compteur avant que l'un des deux ait inséré sa ligne — élimine la
-- course condition "lire N, lire N, insérer, insérer" qui dépasserait la
-- limite.
create or replace function public.check_chat_rate_limit()
returns table (
  ok boolean,
  is_pro boolean,
  limit_hour int,
  used_hour int,
  limit_day int,
  used_day int
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_sub_status text;
  v_is_pro boolean := false;
  v_limit_hour int;
  v_limit_day int;
  v_used_hour int;
  v_used_day int;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  -- Sérialise les appels concurrents pour cet utilisateur : un deuxième
  -- appel simultané attend que le premier ait validé et commité sa ligne
  -- (ou renoncé) avant de recompter à son tour.
  perform pg_advisory_xact_lock(hashtext(v_user_id::text), hashtext('chat_rate_limit'));

  select s.status into v_sub_status
  from public.subscriptions s
  where s.user_id = v_user_id;

  v_is_pro := found and v_sub_status in ('active', 'trialing');

  -- Limites fixées en dur (voir le commentaire en tête de fichier) : jamais
  -- transmises par l'appelant.
  if v_is_pro then
    v_limit_hour := 50;
    v_limit_day := 150;
  else
    v_limit_hour := 15;
    v_limit_day := 40;
  end if;

  select count(*) into v_used_hour
  from public.chat_rate_limit_log
  where user_id = v_user_id
    and created_at >= now() - interval '1 hour';

  select count(*) into v_used_day
  from public.chat_rate_limit_log
  where user_id = v_user_id
    and created_at >= now() - interval '24 hours';

  if v_used_hour >= v_limit_hour or v_used_day >= v_limit_day then
    return query select false, v_is_pro, v_limit_hour, v_used_hour, v_limit_day, v_used_day;
    return;
  end if;

  insert into public.chat_rate_limit_log (user_id) values (v_user_id);

  return query select true, v_is_pro, v_limit_hour, v_used_hour + 1, v_limit_day, v_used_day + 1;
end;
$$;

revoke all on function public.check_chat_rate_limit() from public;
grant execute on function public.check_chat_rate_limit() to authenticated;
