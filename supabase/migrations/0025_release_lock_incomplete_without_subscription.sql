-- Prompt 06.26 : corrige une incohérence de conception dans
-- release_abandoned_checkout_lock() (0024, liste blanche de statuts
-- ajoutée en 06.25) — identifiée par relecture ciblée, puis vérifiée
-- contre les données réelles de production avant application (voir le
-- diagnostic 06.26 : status/stripe_subscription_id/pending_checkout_at du
-- compte concerné, logs Netlify confirmant 'subscription_status_not_safe',
-- vérification Stripe dashboard confirmant l'absence de toute session ou
-- de tout abonnement pour le customer concerné).
--
-- Cette migration est INDÉPENDANTE : elle n'altère ni 0022
-- (reserve_checkout_session, sync_stripe_subscription), ni aucune
-- migration antérieure à 0024 incluse — elle corrige uniquement
-- release_abandoned_checkout_lock() en la recréant (create or replace),
-- exactement comme 0013 avait corrigé 0012 sans modifier son fichier.
--
-- Le problème : reserve_checkout_session() (0022, ligne ~247) insère,
-- pour TOUT nouveau compte lors de sa toute première tentative
-- d'abonnement, une ligne avec `status = 'incomplete'` littéralement en
-- dur et `stripe_subscription_id` laissé à NULL (jamais renseigné par
-- cette fonction). Ce `status` n'est ensuite mis à jour QUE par
-- sync_stripe_subscription() (0022), elle-même déclenchée UNIQUEMENT par
-- un véritable webhook Stripe (customer.subscription.*) — qui ne se
-- produit jamais si aucune session Stripe n'a jamais réellement abouti
-- pour ce compte.
--
-- La liste blanche de statuts ajoutée en 06.25 (migration 0024) ne
-- distingue pas deux significations très différentes de 'incomplete' :
-- (a) Stripe confirme un VRAI abonnement en attente de premier paiement
--     (stripe_subscription_id renseigné par un vrai webhook) — danger
--     réel, doit continuer à bloquer la libération ;
-- (b) aucun abonnement Stripe n'a JAMAIS existé pour ce compte —
--     'incomplete' n'est alors que la valeur par défaut locale posée par
--     reserve_checkout_session avant tout contact avec Stripe
--     (stripe_subscription_id reste NULL) — sans danger, d'autant que
--     route.ts (tryRecoverAbandonedLock) a déjà vérifié directement
--     auprès de Stripe, juste avant cet appel, qu'aucune session
--     Checkout ouverte ni aucun abonnement n'existe pour ce customer.
--
-- Avant ce correctif, le cas (b) était bloqué exactement comme le cas
-- (a) (reason: 'subscription_status_not_safe') — empêchant à vie la voie
-- de récupération rapide (06.19-06.25) pour tout compte dont la toute
-- première tentative d'abonnement a échoué avant la création d'un
-- abonnement Stripe réel, sans aucune raison de sécurité réelle (seul le
-- délai aveugle de 30 minutes, reserve_checkout_session, 0022, inchangé,
-- restait disponible pour ces comptes).
--
-- `stripe_subscription_id IS NULL` est un signal fiable et vérifiable
-- dans le code : reserve_checkout_session() ne l'écrit jamais, et
-- sync_stripe_subscription() l'écrit TOUJOURS conjointement avec
-- `status`, à partir du même événement Stripe authentique (0022, lignes
-- 148-168) — jamais l'un sans l'autre. Donc stripe_subscription_id NULL
-- garantit qu'aucun événement Stripe n'a jamais rien confirmé pour ce
-- compte, quel que soit le `status` local affiché.
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
  v_stripe_subscription_id text;
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

  select status, pending_checkout_at, stripe_subscription_id
    into v_status, v_pending_checkout_at, v_stripe_subscription_id
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

  -- Prompt 06.25 : LISTE BLANCHE de statuts explicitement sûrs,
  -- strictement identique à SAFE_SUBSCRIPTION_STATUSES (route.ts) —
  -- seuls 'canceled' et 'incomplete_expired' autorisent la libération ;
  -- tout le reste bloque par défaut.
  --
  -- Prompt 06.26 (ce correctif) : UNE exception précise et vérifiable,
  -- jamais un assouplissement général — voir la justification complète
  -- en tête de fichier. 'incomplete' SANS stripe_subscription_id associé
  -- ne reflète aucun événement Stripe réel (jamais un vrai abonnement en
  -- attente de paiement) : c'est uniquement le placeholder local posé par
  -- reserve_checkout_session avant tout contact avec Stripe. Un
  -- 'incomplete' AVEC stripe_subscription_id renseigné (un vrai webhook
  -- Stripe a confirmé un abonnement réellement en attente de premier
  -- paiement) continue de bloquer normalement, comme tout statut hors
  -- liste blanche.
  if v_status not in ('canceled', 'incomplete_expired')
     and not (v_status = 'incomplete' and v_stripe_subscription_id is null)
  then
    return query select false, 'subscription_status_not_safe'::text;
    return;
  end if;

  -- Plancher d'âge minimum (06.21/06.24), indépendant du contrôle côté
  -- application, numériquement identique au seuil applicatif
  -- (MIN_LOCK_AGE_BEFORE_RECOVERY_MS, route.ts, 16 minutes, ancré sur le
  -- plafond physique AWS Lambda de 900s) — défense en profondeur, jamais
  -- le seul contrôle.
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
