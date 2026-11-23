-- Prompt 06.30 (suite à une demande explicite et répétée de l'utilisateur :
-- aucune limite de temps, jamais, pour revenir sur /checkout — « si un
-- utilisateur veut faire 100 allers-retours il a le droit »).
--
-- SUPPRIME le plancher d'âge minimum (960 secondes, posé en 0024, point 4,
-- durci en 06.21/06.24) qui empêchait release_abandoned_checkout_lock() de
-- libérer un verrou tant qu'il avait moins de 16 minutes — y compris
-- lorsque l'appelant (route.ts, tryRecoverAbandonedLock) avait déjà vérifié
-- en direct auprès de Stripe qu'aucune session ouverte ni aucun abonnement
-- non sûr n'existait pour ce customer. Dans ce cas, le plancher ne
-- protégeait plus contre rien : il ne faisait qu'imposer une attente
-- supplémentaire, aveugle, après une vérification déjà positive.
--
-- Risque accepté EXPLICITEMENT par l'utilisateur (propriétaire du
-- produit), après explication du compromis : la fenêtre de course réelle
-- (une requête concurrente qui vient de poser le verrou et qui est encore
-- en train d'appeler Stripe, donc sa session n'existe pas ENCORE côté
-- Stripe) dure le temps d'un appel réseau à Stripe — quelques secondes au
-- pire, jamais 16 minutes (ce chiffre était un majorant pathologique
-- construit sur les retries du SDK Stripe, pas une estimation réaliste).
--
-- Cette migration NE TOUCHE à AUCUNE autre protection existante :
-- - le verrou avisoire PostgreSQL (hashtext(user_id), hashtext
--   ('stripe_checkout')), qui sérialise toujours strictement avec
--   reserve_checkout_session() ;
-- - la liste blanche de statuts d'abonnement sûrs (06.25, seuls
--   'canceled'/'incomplete_expired' autorisent la libération) ;
-- - le verrou optimiste (p_expected_pending_checkout_at) ;
-- - le délai aveugle de 30 minutes de reserve_checkout_session() (0022),
--   qui reste le filet de sécurité de dernier recours si la vérification
--   Stripe de l'appelant échoue ou trouve un état non sûr.
-- Seul le point 4 de 0024 (le plancher de 960 secondes lui-même) est
-- retiré ci-dessous.
--
-- À exécuter après 0025_release_lock_incomplete_without_subscription.sql.
-- Ne modifie ni 0022, ni aucune migration antérieure à 0024.

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

  -- Prompt 06.25 : LISTE BLANCHE de statuts explicitement sûrs, strictement
  -- identique à SAFE_SUBSCRIPTION_STATUSES (route.ts). Seuls 'canceled' et
  -- 'incomplete_expired' sont sûrs ; tout le reste bloque, y compris une
  -- valeur NULL et tout statut inconnu ou ambigu. Inchangé par 06.30.
  if v_status is null or v_status not in ('canceled', 'incomplete_expired') then
    return query select false, 'subscription_status_not_safe'::text;
    return;
  end if;

  -- Prompt 06.30 : le plancher d'âge minimum (06.21/06.24, 960 secondes)
  -- est retiré ICI — voir la justification complète en tête de ce fichier.
  -- La protection contre une libération prématurée repose désormais
  -- entièrement sur l'appelant (route.ts, tryRecoverAbandonedLock), qui
  -- n'appelle cette fonction qu'après avoir vérifié en direct auprès de
  -- Stripe qu'aucune session ouverte ni aucun abonnement non sûr n'existe
  -- pour ce customer — et sur le verrou optimiste ci-dessous, qui refuse
  -- toute libération si le verrou a changé depuis cette vérification.

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
