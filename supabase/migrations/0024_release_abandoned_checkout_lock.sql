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
-- 3bis. (Prompt 06.25, durcissement suite à une revue de sécurité ciblée)
--    Au-delà de 'active'/'trialing', liste BLANCHE de statuts sûrs pour
--    tout le reste, identique à SAFE_SUBSCRIPTION_STATUSES (route.ts) :
--    seuls 'canceled' et 'incomplete_expired' autorisent la libération —
--    'incomplete', 'past_due', 'unpaid', 'paused', une valeur NULL ou tout
--    statut futur inconnu de Stripe bloquent, par défaut.
-- 4. (Prompt 06.21/06.24, durcissement suite à des revues de sécurité sur
--    les conditions de concurrence) Âge minimum obligatoire du verrou avant
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
  -- l'appelant côté Stripe. Message distinct ('already_pro') pour ce cas
  -- précis, le plus fréquent et le plus parlant à lire dans les logs.
  if v_status in ('active', 'trialing') then
    return query select false, 'already_pro'::text;
    return;
  end if;

  -- Rien à libérer. Couvre aussi le cas où AUCUNE ligne n'existe pour cet
  -- utilisateur (select ... into ne lève pas d'erreur ; v_status et
  -- v_pending_checkout_at restent simplement NULL) : sûr par construction,
  -- puisqu'il n'y a alors rien à libérer, quel que soit v_status.
  if v_pending_checkout_at is null then
    return query select false, 'no_pending_checkout'::text;
    return;
  end if;

  -- Prompt 06.25 (durcissement, suite à une revue de sécurité ciblée sur
  -- cette incohérence précise) : LISTE BLANCHE de statuts explicitement
  -- sûrs, strictement identique à SAFE_SUBSCRIPTION_STATUSES (route.ts).
  -- Avant ce correctif, seuls 'active'/'trialing' étaient bloqués
  -- (liste NOIRE) : un statut local 'incomplete' (valeur par défaut posée
  -- par reserve_checkout_session, 0022, pour tout nouveau compte), ou
  -- 'past_due'/'unpaid' (paiement en échec avec nouvelle tentative
  -- automatique Stripe), ou 'paused', ou tout statut futur que Stripe
  -- pourrait introduire, n'étaient PAS bloqués par cette RPC — alors que
  -- le code applicatif les traite tous comme non sûrs. Inversé en liste
  -- BLANCHE : seuls 'canceled' et 'incomplete_expired' sont sûrs ; tout le
  -- reste bloque, y compris une valeur NULL (défensif : la colonne
  -- `status` est NOT NULL par contrainte de schéma — 0004_subscriptions.sql
  -- — donc NULL ne devrait jamais être atteint ici en pratique, mais ce
  -- code ne suppose jamais que cette contrainte restera inchangée pour
  -- autant) et tout statut inconnu ou ambigu.
  if v_status is null or v_status not in ('canceled', 'incomplete_expired') then
    return query select false, 'subscription_status_not_safe'::text;
    return;
  end if;

  -- Prompt 06.21/06.24 : plancher d'âge minimum, indépendant du contrôle
  -- côté application. Revu en 06.24 suite à une revue de sécurité posant
  -- précisément cette question : « tous les chemins d'appel de cette
  -- fonction respectent-ils le seuil applicatif ? ». Vérification faite
  -- dans le code TypeScript (grep sur tout `src/`) : le SEUL appelant de
  -- release_abandoned_checkout_lock est tryRecoverAbandonedLock()
  -- (route.ts), qui applique déjà MIN_LOCK_AGE_BEFORE_RECOVERY_MS (16
  -- minutes, ancré sur le plafond physique AWS Lambda de 900s — voir la
  -- justification complète dans route.ts) avant tout appel à cette RPC.
  -- Mais un plancher SQL plus COURT que ce seuil applicatif (comme les
  -- 5 minutes retenues jusqu'ici) ne protège PAS réellement contre un
  -- appel direct de cette fonction en dehors de ce chemin applicatif —
  -- par exemple depuis l'éditeur SQL de Supabase par un opérateur, ou
  -- depuis un futur code qui ne connaîtrait pas ce raisonnement — pour
  -- un verrou âgé de, disons, 7 minutes : ni sûr selon l'analyse ci-
  -- dessus, ni bloqué par un plancher de 5 minutes. Une défense en
  -- profondeur doit appliquer INDÉPENDAMMENT la MÊME invariante de
  -- sécurité, jamais une version affaiblie — ce plancher est donc
  -- désormais numériquement identique au seuil applicatif (960 secondes),
  -- pas seulement « plus court par prudence ».
  if v_pending_checkout_at > now() - interval '960 seconds' then
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
