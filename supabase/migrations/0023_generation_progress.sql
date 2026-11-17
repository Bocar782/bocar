-- Architecture "étapes courtes + progression persistée" (Prompt 05.20.1,
-- suite de l'audit 05.19/05.20 qui a identifié un risque critique : les
-- routes de génération (jusqu'à 540s) dépassent largement la limite réelle
-- des fonctions Netlify synchrones). NE PAS EXÉCUTER CETTE MIGRATION ICI —
-- fichier créé pour validation manuelle par l'utilisateur, à exécuter
-- lui-même sur Supabase. À exécuter après 0022_stripe_reliability.sql.
--
-- Principe : au lieu d'UNE requête HTTP qui fait tout le travail (analyse,
-- recherche, rédaction de chaque leçon, quiz...) puis répond, la génération
-- devient une suite d'appels COURTS et répétés, pilotés par le client :
-- chaque appel réclame la main sur UNE unité de travail (une leçon, un quiz
-- de module, l'étape suivante...), l'exécute (côté TypeScript, un seul
-- appel Anthropic), persiste son résultat ici, puis répond — en quelques
-- secondes, largement sous n'importe quelle limite Netlify plausible. Le
-- client rappelle l'étape suivante jusqu'à la fin. Formations ET analyses
-- utilisent exactement le même mécanisme (aucune différence de fiabilité
-- entre les deux, comme demandé).
--
-- Cette table est une extension 1:1 de `generation_reservations` (0007) :
-- elle ne la modifie pas, n'ajoute aucune colonne dessus, et les deux RPC
-- historiques (`reserve_generation_slot`/`resolve_generation_slot`) restent
-- la SEULE autorité sur les quotas Free/Pro et sur le statut final
-- (pending/completed/released) — réutilisées ici telles quelles, jamais
-- dupliquées. `save_generated_course`/`save_generated_analysis` (0012/0013,
-- et leur équivalent analyse) restent également inchangées : l'étape finale
-- de chaque pipeline les appelle exactement comme le faisaient les anciennes
-- routes, avec la même garantie atomique "jamais de formation/analyse
-- partiellement enregistrée".
--
-- Sécurité (exigence explicite du Prompt 05.20.1) : le client ne peut
-- JAMAIS écrire dans `progress`, déclarer une étape terminée, ni modifier
-- le contenu déjà généré — aucune policy insert/update/delete n'existe sur
-- cette table, seulement une lecture (transparence/debug). Toute écriture
-- passe exclusivement par les fonctions SECURITY DEFINER ci-dessous, qui
-- déterminent systématiquement l'utilisateur via auth.uid() (jamais un
-- paramètre), vérifient la propriété de la réservation, et appliquent un
-- verrou transactionnel par réservation pour qu'aucun conflit entre deux
-- appels simultanés ne soit possible.

create table if not exists public.generation_progress (
  reservation_id uuid primary key references public.generation_reservations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('course', 'analysis')),
  -- Clé d'idempotence fournie par le client (générée une seule fois,
  -- persistée côté navigateur AVANT le premier appel réseau) : un appel
  -- "start" rejoué avec la MÊME clé (perte réseau, double-clic, nouvelle
  -- tentative après un rechargement survenu avant même d'avoir reçu la
  -- réponse) renvoie la réservation déjà créée au lieu d'en créer une
  -- seconde — jamais de double consommation de quota pour une seule
  -- intention de génération.
  idempotency_key text not null,
  -- Entrée figée au démarrage (sujet, plan validé le cas échéant) :
  -- nécessaire pour qu'un appel "étape suivante" ultérieur, servi par une
  -- invocation de fonction totalement différente, sache quoi générer.
  -- Taille bornée en code par `validateProgrammeStructure`/les schémas Zod
  -- déjà existants (2-4 modules, 3-5 leçons/module) AVANT d'être transmise
  -- ici, et re-vérifiée grossièrement ci-dessous (taille en octets) en
  -- défense en profondeur.
  input jsonb not null,
  -- Résultats déjà produits (leçons, quiz de module, résumé, quiz final),
  -- structure précise définie et validée côté TypeScript
  -- (src/lib/generation/progress-schemas.ts) avant tout appel ici — jamais
  -- interprétée ni validée structurellement en SQL, seulement bornée en
  -- taille. Effacée (réservation résolue) une fois la formation/l'analyse
  -- réellement enregistrée : jamais conservée au-delà de la génération
  -- active.
  progress jsonb not null default '{}'::jsonb,
  -- Verrou applicatif : une invocation qui réclame une étape pose son
  -- propre jeton ici ; une autre invocation concurrente (requête dupliquée,
  -- reprise après rechargement pendant qu'un onglet précédent tourne
  -- encore...) voit qu'une étape est déjà en cours et n'exécute jamais le
  -- même travail en double. `claimed_at` permet de détecter une
  -- réclamation abandonnée (fonction interrompue avant d'avoir validé ou
  -- échoué son étape) et de la réclamer à nouveau après un délai.
  claimed_step text,
  claimed_at timestamptz,
  attempt_count int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Une seule tâche de génération par (utilisateur, type, clé d'idempotence) :
-- garantit au niveau base de données, pas seulement en application, qu'un
-- "start" rejoué ne peut jamais créer une seconde ligne.
create unique index if not exists generation_progress_user_kind_idemkey_idx
  on public.generation_progress (user_id, kind, idempotency_key);

alter table public.generation_progress enable row level security;

-- Lecture seule pour l'utilisateur (transparence/debug, même logique que
-- generation_reservations depuis 0007) : rien dans l'app n'affiche ces
-- lignes brutes, seulement des résumés dérivés via
-- get_generation_progress_summary ci-dessous. Aucune policy
-- insert/update/delete : impossible pour le client d'écrire ici autrement
-- que par les fonctions SECURITY DEFINER qui suivent.
drop policy if exists "generation_progress_owner_select" on public.generation_progress;
create policy "generation_progress_owner_select"
  on public.generation_progress
  for select
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- 1. start_generation_task : réserve le quota (réutilise
--    reserve_generation_slot, 0007/0019, sans le dupliquer) puis crée la
--    tâche de progression, ou renvoie la tâche déjà créée pour la même
--    clé d'idempotence si "start" est rejoué.
-- ---------------------------------------------------------------------
create or replace function public.start_generation_task(
  p_kind text,
  p_idempotency_key text,
  p_input jsonb
) returns table (
  reservation_id uuid,
  already_existed boolean,
  ok boolean,
  is_pro boolean,
  limit_count int,
  used_count int
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing_id uuid;
  v_existing_input jsonb;
  v_reserve record;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if p_kind not in ('course', 'analysis') then
    raise exception 'invalid_kind';
  end if;

  if p_idempotency_key is null or length(p_idempotency_key) = 0 or length(p_idempotency_key) > 200 then
    raise exception 'invalid_idempotency_key';
  end if;

  -- Bornage grossier de taille, en complément de la validation structurelle
  -- déjà faite côté TypeScript avant cet appel (Zod + validateProgrammeStructure) :
  -- jamais la seule garantie, juste un filet de sécurité si cette validation
  -- était un jour contournée ou oubliée par un futur appelant.
  if p_input is null or pg_column_size(p_input) > 200000 then
    raise exception 'invalid_input';
  end if;

  -- Sérialise les appels concurrents pour CETTE clé précise (deux requêtes
  -- "start" quasi simultanées avec la même clé, ex. double-clic réseau) :
  -- la seconde attend que la première ait inséré sa ligne avant de
  -- vérifier l'idempotence, pour ne jamais créer deux réservations pour la
  -- même intention. N'entre jamais en conflit avec le verrou propre de
  -- `reserve_generation_slot` (clé différente : celle-ci inclut la clé
  -- d'idempotence, pas seulement l'utilisateur et le type).
  perform pg_advisory_xact_lock(hashtext(v_user_id::text || ':' || p_kind || ':' || p_idempotency_key));

  select gp.reservation_id, gp.input into v_existing_id, v_existing_input
  from public.generation_progress gp
  where gp.user_id = v_user_id
    and gp.kind = p_kind
    and gp.idempotency_key = p_idempotency_key;

  if v_existing_id is not null then
    -- Prompt 05.20.2 : une même clé d'idempotence ne doit JAMAIS permettre
    -- de réutiliser silencieusement une réservation existante avec un
    -- contenu de demande différent (sujet/plan changé) — l'appelant
    -- recevrait alors, sans le savoir, la progression d'une tout autre
    -- génération. L'égalité jsonb ignore l'ordre des clés d'un objet mais
    -- PAS l'ordre des tableaux : une resoumission véritablement identique
    -- (même objet sérialisé par le même client) reste toujours égale.
    if v_existing_input is distinct from p_input then
      raise exception 'idempotency_key_payload_mismatch';
    end if;
    return query select v_existing_id, true, true, null::boolean, null::int, null::int;
    return;
  end if;

  select * into v_reserve from public.reserve_generation_slot(p_kind);

  if not v_reserve.ok then
    return query select null::uuid, false, false, v_reserve.is_pro, v_reserve.limit_count, v_reserve.used_count;
    return;
  end if;

  insert into public.generation_progress (reservation_id, user_id, kind, idempotency_key, input, progress)
  values (v_reserve.reservation_id, v_user_id, p_kind, p_idempotency_key, p_input, '{}'::jsonb);

  return query select v_reserve.reservation_id, false, true, v_reserve.is_pro, v_reserve.limit_count, v_reserve.used_count;
end;
$$;

revoke all on function public.start_generation_task(text, text, jsonb) from public;
grant execute on function public.start_generation_task(text, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- 2. claim_generation_step : réclame la main sur la tâche pour une
--    invocation (identifiée par p_claim_token, généré côté serveur à
--    chaque appel HTTP) ; renvoie l'entrée et la progression actuelles
--    pour que l'appelant décide quelle unité de travail exécuter ensuite.
--    Jamais deux invocations avec la main en même temps sur la même tâche.
-- ---------------------------------------------------------------------
create or replace function public.claim_generation_step(
  p_reservation_id uuid,
  p_claim_token text,
  p_stale_after_seconds int default 45
) returns table (
  claimed boolean,
  reason text,
  input jsonb,
  progress jsonb,
  reservation_status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_row record;
  v_stale_after_seconds int;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if p_claim_token is null or length(p_claim_token) = 0 then
    raise exception 'invalid_claim_token';
  end if;

  -- Cette fonction est accordée au rôle `authenticated` (voir plus bas), donc
  -- appelable directement par le client, pas seulement via notre route
  -- serveur : on ne fait jamais confiance à p_stale_after_seconds tel quel.
  -- Borne basse : un jeton de verrouillage (claim_token) protège déjà toute
  -- écriture tardive d'un worker périmé (voir commit/fail_generation_step),
  -- donc réduire cette fenêtre ne peut jamais causer de corruption, seulement
  -- du travail dupliqué si l'ancien worker est encore en vol — aucun risque
  -- à l'autoriser sur SA PROPRE réservation. Borne haute : évite qu'une
  -- valeur absurde (ou une fenêtre par défaut mal choisie) ne bloque le
  -- rétablissement après une fonction Netlify tuée abruptement pendant
  -- plusieurs minutes. 45s par défaut : nettement supérieur au temps d'un
  -- appel Anthropic normal, mais assez court pour que l'utilisateur qui
  -- revient sur l'onglet après une coupure réseau puisse reprendre vite.
  v_stale_after_seconds := greatest(15, least(coalesce(p_stale_after_seconds, 45), 600));

  -- Verrou par réservation (pas par utilisateur) : deux onglets ouverts
  -- sur la MÊME génération, ou un rechargement pendant qu'un appel
  -- précédent est encore en vol, ne peuvent jamais obtenir la main en
  -- même temps sur cette tâche précise.
  perform pg_advisory_xact_lock(hashtext(p_reservation_id::text));

  select gp.claimed_step, gp.claimed_at, gp.input, gp.progress, gr.status as reservation_status
    into v_row
  from public.generation_progress gp
  join public.generation_reservations gr on gr.id = gp.reservation_id
  where gp.reservation_id = p_reservation_id
    and gp.user_id = v_user_id
  for update of gp;

  if not found then
    return query select false, 'not_found', null::jsonb, null::jsonb, null::text;
    return;
  end if;

  if v_row.reservation_status <> 'pending' then
    -- Déjà résolue (formation/analyse enregistrée, ou abandonnée) : rien à
    -- réclamer. L'appelant doit relire l'état via getGenerationStatus
    -- plutôt que de continuer à avancer sur une tâche déjà terminée.
    return query select false, 'already_resolved', v_row.input, v_row.progress, v_row.reservation_status;
    return;
  end if;

  if v_row.claimed_step is not null
     and v_row.claimed_at is not null
     and v_row.claimed_at > now() - (v_stale_after_seconds || ' seconds')::interval then
    return query select false, 'already_in_progress', null::jsonb, null::jsonb, v_row.reservation_status;
    return;
  end if;

  update public.generation_progress
  set claimed_step = p_claim_token,
      claimed_at = now(),
      attempt_count = attempt_count + 1,
      updated_at = now()
  where reservation_id = p_reservation_id;

  return query select true, null::text, v_row.input, v_row.progress, v_row.reservation_status;
end;
$$;

revoke all on function public.claim_generation_step(uuid, text, int) from public;
grant execute on function public.claim_generation_step(uuid, text, int) to authenticated;

-- ---------------------------------------------------------------------
-- 3. commit_generation_step : enregistre le résultat d'une unité de
--    travail et relâche la réclamation. `p_progress_patch` REMPLACE (ne
--    fusionne jamais en profondeur) chaque clé de premier niveau qu'il
--    contient — l'appelant TypeScript doit donc toujours y placer la
--    valeur COMPLÈTE souhaitée pour chaque clé (ex. l'intégralité de la
--    carte des chapitres déjà écrits, pas seulement le nouveau), jamais un
--    delta partiel. Refuse d'appliquer le résultat si la réclamation a
--    expiré entre-temps (une autre invocation a pris la main) : jamais
--    d'écriture d'un travail devenu obsolète par-dessus un travail plus
--    récent.
-- ---------------------------------------------------------------------
create or replace function public.commit_generation_step(
  p_reservation_id uuid,
  p_claim_token text,
  p_progress_patch jsonb
) returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_current record;
  v_merged jsonb;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  if p_progress_patch is null or jsonb_typeof(p_progress_patch) <> 'object' then
    raise exception 'invalid_progress_patch';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_reservation_id::text));

  select gp.claimed_step, gp.progress
    into v_current
  from public.generation_progress gp
  where gp.reservation_id = p_reservation_id
    and gp.user_id = v_user_id
  for update;

  if not found then
    return query select false, 'not_found';
    return;
  end if;

  if v_current.claimed_step is distinct from p_claim_token then
    return query select false, 'claim_expired';
    return;
  end if;

  v_merged := v_current.progress || p_progress_patch;

  -- Bornage de taille (exigence explicite : jamais de données inutilement
  -- volumineuses). Généreux mais fini : une formation est structurellement
  -- plafonnée à 4 modules × 5 leçons, une analyse à 7 cas — ce plafond ne
  -- devrait jamais être atteint en pratique, il protège contre une anomalie.
  if pg_column_size(v_merged) > 3000000 then
    raise exception 'progress_too_large';
  end if;

  update public.generation_progress
  set progress = v_merged,
      claimed_step = null,
      claimed_at = null,
      last_error = null,
      updated_at = now()
  where reservation_id = p_reservation_id;

  return query select true, null::text;
end;
$$;

revoke all on function public.commit_generation_step(uuid, text, jsonb) from public;
grant execute on function public.commit_generation_step(uuid, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- 4. fail_generation_step : relâche la réclamation après un échec
--    (transitoire ou non) SANS toucher au statut de la réservation — le
--    client décide, selon le message renvoyé par la route API, de
--    réessayer l'étape (erreur jugée transitoire) ou d'abandonner. Une
--    tâche abandonnée reste "pending" jusqu'à l'expiration de 15 minutes
--    déjà gérée par reserve_generation_slot (0007/0014, INCHANGÉE) : aucun
--    nouveau mécanisme de nettoyage n'est nécessaire.
-- ---------------------------------------------------------------------
create or replace function public.fail_generation_step(
  p_reservation_id uuid,
  p_claim_token text,
  p_error text
) returns table (ok boolean, reason text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_current record;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_reservation_id::text));

  select gp.claimed_step
    into v_current
  from public.generation_progress gp
  where gp.reservation_id = p_reservation_id
    and gp.user_id = v_user_id
  for update;

  if not found then
    return query select false, 'not_found';
    return;
  end if;

  if v_current.claimed_step is distinct from p_claim_token then
    return query select false, 'claim_expired';
    return;
  end if;

  update public.generation_progress
  set claimed_step = null,
      claimed_at = null,
      last_error = left(coalesce(p_error, 'Erreur inconnue.'), 2000),
      updated_at = now()
  where reservation_id = p_reservation_id;

  return query select true, null::text;
end;
$$;

revoke all on function public.fail_generation_step(uuid, text, text) from public;
grant execute on function public.fail_generation_step(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 5. get_generation_progress_summary : lecture seule, pour la reprise
--    après rechargement (generation-status.ts) — renvoie un résumé LÉGER
--    (étape en cours, nombre de tentatives, dernière erreur), jamais le
--    contenu déjà généré en entier : le client n'a jamais besoin de
--    retélécharger les leçons déjà écrites pour savoir où en est la
--    génération.
-- ---------------------------------------------------------------------
create or replace function public.get_generation_progress_summary(
  p_reservation_id uuid
) returns table (
  found boolean,
  reservation_status text,
  stage text,
  attempt_count int,
  last_error text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_row record;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  select (gp.progress ->> 'stage') as stage, gp.attempt_count, gp.last_error, gr.status as reservation_status
    into v_row
  from public.generation_progress gp
  join public.generation_reservations gr on gr.id = gp.reservation_id
  where gp.reservation_id = p_reservation_id
    and gp.user_id = v_user_id;

  if not found then
    return query select false, null::text, null::text, null::int, null::text;
    return;
  end if;

  return query select true, v_row.reservation_status, v_row.stage, v_row.attempt_count, v_row.last_error;
end;
$$;

revoke all on function public.get_generation_progress_summary(uuid) from public;
grant execute on function public.get_generation_progress_summary(uuid) to authenticated;
