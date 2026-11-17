-- Corrige les problèmes de fiabilité Stripe identifiés par l'audit 05.17
-- (Prompt 05.17.3) : le webhook Stripe (src/app/api/stripe/webhook/route.ts)
-- ne vérifiait jamais le résultat de ses écritures Supabase (`upsert`
-- silencieux, toujours 200), ne protégeait contre aucun événement dupliqué
-- ni livré dans le désordre, et `/api/stripe/checkout` ne protégeait pas
-- contre la création d'un second abonnement (double facturation) en cas de
-- requêtes concurrentes.
-- À exécuter après 0021_lock_quiz_rpc_to_free_plan.sql. Ne modifie ni 0019,
-- ni 0020, ni 0021.
--
-- Stratégie retenue pour l'ordre des événements de synchronisation
-- d'abonnement (customer.subscription.created/updated/deleted et
-- checkout.session.completed), conformément à la demande explicite de ne
-- jamais se fier uniquement à `event.created`, ni à une simple relecture
-- Stripe sans protection des écritures concurrentes :
-- 1. Le code applicatif (route.ts) relit TOUJOURS l'état actuel de
--    l'abonnement directement depuis l'API Stripe (`stripe.subscriptions
--    .retrieve`) avant d'appeler cette migration — jamais l'objet embarqué
--    dans l'événement, qui peut être périmé si les événements arrivent dans
--    le désordre. Ceci résout déjà la majorité des cas réels : peu importe
--    l'ordre d'arrivée des WEBHOOKS, chaque appel écrit l'état VRAIMENT
--    actuel au moment de l'appel.
-- 2. Cela ne suffit pas seul : deux appels concurrents (ex. un événement
--    ancien retraité tardivement par Stripe, et un événement récent) qui
--    relisent Stripe à des instants différents peuvent terminer leurs
--    écritures Supabase dans un ordre différent de celui des faits réels.
--    `sync_stripe_subscription()` ci-dessous applique donc en plus un
--    verrou de version ATOMIQUE côté base de données, basé sur
--    `event.created` (horodatage Unix de l'événement QUI A DÉCLENCHÉ la
--    relecture Stripe, jamais transmis par le navigateur) : une écriture
--    dont l'`event.created` est strictement antérieur au dernier déjà
--    appliqué pour cet utilisateur est automatiquement rejetée par la
--    clause `where` de l'upsert, sans jamais écraser un état plus récent —
--    qu'importe l'ordre réel d'arrivée des requêtes HTTP. C'est la
--    combinaison des deux techniques, pas l'une seule, qui rend la
--    synchronisation fiable.
-- 3. La déduplication des événements (même `event.id` livré plusieurs
--    fois par Stripe, livraison "at-least-once") est traitée séparément,
--    par une contrainte d'unicité sur `stripe_webhook_events.event_id` :
--    la seconde livraison du même événement échoue silencieusement sur ce
--    conflit et n'applique aucune écriture une deuxième fois.

-- ---------------------------------------------------------------------
-- 1. Colonnes additionnelles sur `subscriptions`.
-- ---------------------------------------------------------------------

-- `stripe_customer_id` devient nullable : `reserve_checkout_session()`
-- doit pouvoir marquer "une session de paiement est en cours" pour un
-- utilisateur qui n'a encore AUCUN customer Stripe (tout premier
-- abonnement), avant même que ce customer soit créé côté Stripe par
-- l'appelant — la vraie valeur est renseignée dès que le webhook
-- correspondant arrive.
alter table public.subscriptions
  alter column stripe_customer_id drop not null;

alter table public.subscriptions
  add column if not exists cancel_at_period_end boolean not null default false;

-- Horodatage (Unix, converti) de l'événement Stripe qui a produit la
-- dernière écriture appliquée à cette ligne — jamais l'heure de réception
-- HTTP, qui ne reflète pas l'ordre réel des faits côté Stripe. `null` tant
-- qu'aucun événement n'a encore été appliqué (ligne créée uniquement par
-- `reserve_checkout_session`, pas encore par un webhook).
alter table public.subscriptions
  add column if not exists last_event_created_at timestamptz;

-- Non nul tant qu'une session Stripe Checkout a été réservée pour cet
-- utilisateur et n'a pas encore été confirmée par un webhook (ou n'est pas
-- encore considérée comme abandonnée, voir `reserve_checkout_session`).
alter table public.subscriptions
  add column if not exists pending_checkout_at timestamptz;

-- ---------------------------------------------------------------------
-- 2. Déduplication des événements webhook déjà traités.
-- ---------------------------------------------------------------------
create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  event_created_at timestamptz not null,
  received_at timestamptz not null default now()
);

-- RLS activée par cohérence avec le reste du schéma, sans AUCUNE policy :
-- cette table n'est jamais lue ni écrite autrement que par les fonctions
-- SECURITY DEFINER ci-dessous (qui s'exécutent avec les droits de leur
-- PROPRIÉTAIRE, lequel contourne nativement RLS sur les tables qu'il
-- possède) — ni `authenticated`, ni `anon`, ni même `service_role` n'ont
-- de policy ni de GRANT dessus.
alter table public.stripe_webhook_events enable row level security;

-- ---------------------------------------------------------------------
-- 3. sync_stripe_subscription : synchronisation atomique (dédup +
--    protection anti-désordre) de l'état d'un abonnement Stripe.
--    Appelée UNIQUEMENT par le webhook (client admin/service_role),
--    jamais par un client authentifié : `p_user_id` est un paramètre
--    explicite (dérivé de `subscription.metadata.supabase_user_id` côté
--    TypeScript), jamais `auth.uid()` — raison pour laquelle l'exécution
--    n'est accordée qu'à `service_role`.
-- ---------------------------------------------------------------------
create or replace function public.sync_stripe_subscription(
  p_event_id text,
  p_event_type text,
  p_event_created bigint,
  p_user_id uuid,
  p_customer_id text,
  p_subscription_id text,
  p_status text,
  p_current_period_start timestamptz,
  p_current_period_end timestamptz,
  p_cancel_at_period_end boolean
) returns table (applied boolean, duplicate boolean, reason text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_created_at timestamptz;
  v_inserted int;
  v_updated int;
begin
  if p_event_id is null or p_user_id is null then
    raise exception 'missing_required_argument';
  end if;

  v_event_created_at := to_timestamp(p_event_created);

  -- Déduplication : la deuxième livraison du même `event.id` (Stripe
  -- livre "at-least-once") ne doit jamais appliquer une deuxième fois la
  -- même écriture. `on conflict do nothing` rend cette étape elle-même
  -- idempotente, sans jamais lever d'erreur.
  insert into public.stripe_webhook_events (event_id, event_type, event_created_at)
  values (p_event_id, p_event_type, v_event_created_at)
  on conflict (event_id) do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then
    return query select false, true, 'duplicate_event'::text;
    return;
  end if;

  -- Upsert atomique avec verrou de version : la clause `where` ne laisse
  -- l'écriture s'appliquer que si aucun événement plus récent n'a déjà été
  -- traité pour cet utilisateur — qu'importe l'ordre d'arrivée réel de
  -- CETTE requête HTTP. Si la ligne existe déjà et que la clause échoue,
  -- `on conflict ... do update ... where ...` ne modifie RIEN (comportement
  -- natif de Postgres), sans jamais lever d'erreur — ce n'est pas un échec,
  -- c'est la protection qui fonctionne comme prévu.
  insert into public.subscriptions (
    user_id, stripe_customer_id, stripe_subscription_id, status,
    current_period_start, current_period_end, cancel_at_period_end,
    last_event_created_at, pending_checkout_at, updated_at
  ) values (
    p_user_id, p_customer_id, p_subscription_id, p_status,
    p_current_period_start, p_current_period_end, coalesce(p_cancel_at_period_end, false),
    v_event_created_at, null, now()
  )
  on conflict (user_id) do update set
    stripe_customer_id = excluded.stripe_customer_id,
    stripe_subscription_id = excluded.stripe_subscription_id,
    status = excluded.status,
    current_period_start = excluded.current_period_start,
    current_period_end = excluded.current_period_end,
    cancel_at_period_end = excluded.cancel_at_period_end,
    last_event_created_at = excluded.last_event_created_at,
    pending_checkout_at = null,
    updated_at = now()
  where public.subscriptions.last_event_created_at is null
     or public.subscriptions.last_event_created_at <= excluded.last_event_created_at;

  get diagnostics v_updated = row_count;

  if v_updated = 0 then
    return query select false, false, 'stale_event'::text;
  else
    return query select true, false, 'applied'::text;
  end if;
end;
$$;

revoke all on function public.sync_stripe_subscription(
  text, text, bigint, uuid, text, text, text, timestamptz, timestamptz, boolean
) from public;
grant execute on function public.sync_stripe_subscription(
  text, text, bigint, uuid, text, text, text, timestamptz, timestamptz, boolean
) to service_role;

-- ---------------------------------------------------------------------
-- 4. reserve_checkout_session : empêche deux requêtes Checkout
--    concurrentes (ou un utilisateur déjà Pro) de créer un second
--    abonnement. Appelée uniquement par /api/stripe/checkout (client
--    admin/service_role) AVANT tout appel à l'API Stripe — `p_user_id`
--    est un paramètre explicite pour la même raison que ci-dessus, d'où
--    l'exécution réservée à `service_role`.
-- ---------------------------------------------------------------------
create or replace function public.reserve_checkout_session(p_user_id uuid)
returns table (ok boolean, reason text, existing_customer_id text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_exists boolean;
  v_status text;
  v_customer_id text;
  v_pending_checkout_at timestamptz;
begin
  if p_user_id is null then
    raise exception 'missing_user_id';
  end if;

  -- Sérialise les appels concurrents pour CET utilisateur : le deuxième
  -- appel attend que le premier ait committé (ou annulé) sa décision avant
  -- de lire l'état à son tour — élimine la course "aucune ligne encore,
  -- aucune ligne encore, créer, créer" entre deux requêtes Checkout
  -- parallèles, exactement comme reserve_generation_slot() (0007) pour les
  -- quotas de génération.
  perform pg_advisory_xact_lock(hashtext(p_user_id::text), hashtext('stripe_checkout'));

  select true, status, stripe_customer_id, pending_checkout_at
    into v_exists, v_status, v_customer_id, v_pending_checkout_at
  from public.subscriptions
  where user_id = p_user_id;

  if v_status in ('active', 'trialing') then
    return query select false, 'already_pro'::text, v_customer_id;
    return;
  end if;

  -- Une session Checkout a déjà été réservée récemment pour cet
  -- utilisateur et n'a pas encore été confirmée par un webhook : refuse la
  -- création d'une seconde session plutôt que de risquer deux abonnements
  -- Stripe pour le même utilisateur. Au-delà de 30 minutes (largement
  -- supérieur à la durée normale d'un paiement), on considère la
  -- précédente tentative abandonnée et on laisse une nouvelle démarrer —
  -- même logique que le délai de 15 minutes des réservations de quota de
  -- génération (0007/0014), adapté à un parcours de paiement.
  if v_pending_checkout_at is not null and v_pending_checkout_at > now() - interval '30 minutes' then
    return query select false, 'checkout_in_progress'::text, v_customer_id;
    return;
  end if;

  if v_exists then
    update public.subscriptions
    set pending_checkout_at = now()
    where user_id = p_user_id;
  else
    insert into public.subscriptions (user_id, stripe_customer_id, status, pending_checkout_at)
    values (p_user_id, null, 'incomplete', now());
  end if;

  return query select true, 'ok'::text, v_customer_id;
end;
$$;

revoke all on function public.reserve_checkout_session(uuid) from public;
grant execute on function public.reserve_checkout_session(uuid) to service_role;
