-- Prompt 06.19 : récupération sécurisée d'un verrou de paiement abandonné
-- (pending_checkout_at posé par reserve_checkout_session, 0022), vérifiée
-- contre l'état RÉEL de Stripe plutôt que la seule expiration à 30 minutes
-- déjà en place. Cette migration est INDÉPENDANTE : elle n'altère NI
-- reserve_checkout_session NI sync_stripe_subscription (0022), ni aucune
-- autre migration déjà appliquée — elle ajoute uniquement une nouvelle
-- fonction.
--
-- Contexte : reserve_checkout_session() refuse déjà toute nouvelle tentative
-- de paiement tant que pending_checkout_at est vieux de moins de 30 minutes
-- (protection anti-double-abonnement). Ce délai est une garde-fou temporel
-- aveugle : il ne regarde jamais si une session Stripe est réellement encore
-- ouverte. release_abandoned_checkout_lock() ajoute une voie de récupération
-- plus rapide, mais UNIQUEMENT lorsque l'appelant (route.ts) a déjà vérifié
-- côté Stripe, juste avant cet appel, qu'aucune session Checkout ouverte ni
-- aucun abonnement actif n'existe pour ce customer — cette fonction ne fait
-- AUCUN appel réseau elle-même, elle fait uniquement confiance à ce que
-- l'appelant lui dit avoir vérifié, et se protège contre les courses avec
-- un double contrôle atomique :
-- 1. Même verrou avisoire que reserve_checkout_session (hashtext(user_id),
--    hashtext('stripe_checkout')) — sérialise strictement avec elle, aucune
--    nouvelle voie de contournement du verrou existant.
-- 2. Verrou optimiste : ne libère QUE si pending_checkout_at est encore
--    EXACTEMENT égal à la valeur lue par l'appelant au moment de sa
--    vérification Stripe (p_expected_pending_checkout_at) — si une tentative
--    plus récente a reposé le verrou entre-temps (nouvelle valeur), cette
--    fonction ne touche RIEN, pour ne jamais écraser un verrou légitime plus
--    récent que celui qui a été vérifié.
-- 3. Relit status au moment de l'exécution et refuse si 'active'/'trialing'
--    — ne touche jamais un abonnement réellement actif, même si l'appelant
--    s'est trompé.
-- 4. (Prompt 06.21, durcissement suite à une revue de sécurité sur les
--    conditions de concurrence) Âge minimum obligatoire du verrou avant
--    toute libération, appliqué ICI, indépendamment de tout contrôle côté
--    application : un verrou tout juste posé peut appartenir à une requête
--    encore en train de communiquer avec Stripe (elle n'a simplement pas
--    encore créé sa session Checkout) — chercher "y a-t-il une session ?"
--    à cet instant donnerait "non" pour une mauvaise raison, indiscernable
--    d'un verrou réellement abandonné. Ce plancher protège même si
--    l'appelant (route.ts) venait un jour à oublier son propre contrôle
--    d'âge : défense en profondeur, jamais la seule protection.
-- À exécuter après 0023_generation_progress.sql. Ne modifie ni 0022, ni
-- aucune migration antérieure.

create or replace function public.release_abandoned_checkout_lock(
  p_user_id uuid,
  p_expected_pending_checkout_at timestamptz
) returns table (released boolean, reason text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_pending_checkout_at timestamptz;
begin
  if p_user_id is null then
    raise exception 'missing_user_id';
  end if;

  if p_expected_pending_checkout_at is null then
    raise exception 'missing_expected_pending_checkout_at';
  end if;

  -- Même verrou avisoire que reserve_checkout_session() : les deux
  -- fonctions sont strictement sérialisées entre elles pour un même
  -- utilisateur, par construction — aucune nouvelle voie de contournement
  -- du verrou anti-double-abonnement existant.
  perform pg_advisory_xact_lock(hashtext(p_user_id::text), hashtext('stripe_checkout'));

  select status, pending_checkout_at
    into v_status, v_pending_checkout_at
  from public.subscriptions
  where user_id = p_user_id;

  -- Ne touche jamais un abonnement réellement actif, quoi qu'ait vérifié
  -- l'appelant côté Stripe.
  if v_status in ('active', 'trialing') then
    return query select false, 'already_pro'::text;
    return;
  end if;

  -- Rien à libérer.
  if v_pending_checkout_at is null then
    return query select false, 'no_pending_checkout'::text;
    return;
  end if;

  -- Prompt 06.21/06.22 : plancher d'âge minimum, indépendant du contrôle
  -- côté application — voir la justification en tête de fichier. 60
  -- secondes : volontairement bien plus court que le seuil applicatif de
  -- 3 minutes (MIN_LOCK_AGE_BEFORE_RECOVERY_MS, route.ts, aligné sur
  -- maxDuration=120s + marge), car cette fonction ne fait elle-même AUCUN
  -- appel Stripe et n'a donc pas besoin de la même marge ; c'est un filet
  -- de sécurité de dernier recours, pas le contrôle principal — en
  -- pratique le seuil applicatif de 3 minutes est toujours atteint en
  -- premier.
  if v_pending_checkout_at > now() - interval '60 seconds' then
    return query select false, 'lock_too_recent'::text;
    return;
  end if;

  -- Verrou optimiste : le verrou a changé depuis la vérification Stripe de
  -- l'appelant (nouvelle tentative légitime entre-temps, ou déjà libéré par
  -- un appel concurrent) — ne jamais écraser un état plus récent que celui
  -- qui a été vérifié.
  if v_pending_checkout_at <> p_expected_pending_checkout_at then
    return query select false, 'lock_changed_since_verification'::text;
    return;
  end if;

  update public.subscriptions
  set pending_checkout_at = null
  where user_id = p_user_id;

  return query select true, 'released'::text;
end;
$$;

revoke all on function public.release_abandoned_checkout_lock(uuid, timestamptz) from public;
grant execute on function public.release_abandoned_checkout_lock(uuid, timestamptz) to service_role;
