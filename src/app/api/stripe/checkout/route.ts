import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createStripeClient } from "@/lib/stripe/client";
import { getStripePriceId } from "@/lib/stripe/env";
import { getSiteUrl } from "@/lib/site-url";
import { checkRequestOrigin } from "@/lib/security/origin-check";

export const dynamic = "force-dynamic";
// Prompt 06.22 (durcissement, suite à une revue de sécurité sur la durée
// maximale réelle de toute la séquence de création Checkout — pas
// seulement un appel Stripe isolé) : cette route pouvait auparavant
// tourner pour une durée NON BORNÉE par la plateforme, contrairement à
// toutes les autres routes de ce projet qui appellent Stripe/Supabase
// (/api/chat: 60s, /api/courses/plan, /api/courses/generate,
// /api/analysis/generate: 120s chacune). Sans cette limite, aucun calcul
// de seuil de récupération de verrou (voir tryRecoverAbandonedLock
// ci-dessous) ne pouvait être fiable : impossible de borner le pire cas
// réel. Fixée à 120s, cohérente avec les autres routes Stripe/Supabase du
// projet — la plateforme tue désormais la fonction au-delà, qu'importe ce
// que le SDK Stripe est en train de tenter (y compris ses propres retries
// automatiques, voir MIN_LOCK_AGE_BEFORE_RECOVERY_MS plus bas).
export const maxDuration = 120;

// Crée une session Stripe Checkout (abonnement Pro) et redirige l'utilisateur
// vers la page de paiement hébergée par Stripe.
export async function POST(request: Request) {
  // Prompt 06.18 (correctif) : identifiant court par tentative, présent sur
  // CHAQUE ligne de log ci-dessous — permet de reconstituer dans les logs
  // Netlify le déroulé exact d'un essai précis (jusqu'où il est allé, à
  // quelle étape il s'est arrêté) sans avoir besoin d'interroger Supabase
  // ou Stripe manuellement pour le diagnostiquer.
  const attemptId = randomUUID().slice(0, 8);
  const log = (step: string, details?: Record<string, unknown>) =>
    console.info(`[stripe/checkout:${attemptId}] ${step}`, details ?? {});

  log("1_route_appelee");

  const originError = checkRequestOrigin(request);
  if (originError) {
    log("2_origine_refusee");
    return originError;
  }
  log("2_origine_validee");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    log("3_authentification_refusee");
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }
  log("3_authentification_validee", { userId: user.id });

  const stripe = createStripeClient();
  const admin = createAdminClient();
  const siteUrl = getSiteUrl();

  // Prompt 05.17.3 (correction de la faille de double abonnement de
  // l'audit 05.17) : vérifie et réserve atomiquement, côté base de
  // données, le droit de créer une session Checkout AVANT tout appel à
  // Stripe — jamais fait confiance à l'interface. `reserve_checkout_session`
  // (0022_stripe_reliability.sql) verrouille sur l'utilisateur pour la
  // durée de l'appel : si deux requêtes Checkout arrivent en même temps,
  // une seule obtient `ok: true`, l'autre se voit immédiatement refusée
  // (`checkout_in_progress`) avant même de contacter Stripe. Un
  // utilisateur déjà Pro (`already_pro`) est refusé de la même façon.
  const { data: reservationData, error: reservationError } = await admin
    .rpc("reserve_checkout_session", { p_user_id: user.id })
    .single<{ ok: boolean; reason: string; existing_customer_id: string | null }>();
  let reservation = reservationData;

  if (reservationError || !reservation) {
    log("4_reservation_echec_technique", { error: reservationError?.message });
    return NextResponse.json(
      { error: "Impossible de vérifier ton abonnement pour le moment. Réessaie dans un instant." },
      { status: 503 },
    );
  }

  if (!reservation.ok) {
    log("4_reservation_refusee", {
      reason: reservation.reason,
      existingCustomerId: reservation.existing_customer_id,
    });

    // Prompt 06.19 (correctif) : plutôt que de faire attendre 30 minutes à
    // l'aveugle (seule protection jusqu'ici), on vérifie directement auprès
    // de Stripe si le verrou correspond réellement à un paiement en cours.
    // Ne s'applique jamais à `already_pro` (abonnement actif — jamais
    // touché) ni si la vérification Stripe est impossible ou incertaine
    // (fail closed : aucune libération dans ce cas).
    if (reservation.reason === "checkout_in_progress") {
      const recovered = await tryRecoverAbandonedLock(
        stripe,
        admin,
        user.id,
        reservation.existing_customer_id,
        attemptId,
        log,
      );
      if (recovered) {
        reservation = recovered;
      }
    }

    if (!reservation.ok) {
      const message =
        reservation.reason === "already_pro"
          ? "Tu as déjà un abonnement Pro actif."
          : "Une session de paiement est déjà en cours pour ce compte. Réessaie dans quelques instants.";
      return NextResponse.json({ error: message }, { status: 409 });
    }
  }
  log("4_reservation_validee", { existingCustomerId: reservation.existing_customer_id });

  // Prompt 06.15 (correctif) : si l'appel Stripe échoue pour n'importe
  // quelle raison après la réservation ci-dessus, le verrou posé par
  // `reserve_checkout_session` doit être relâché explicitement — sinon il
  // reste actif jusqu'à 30 minutes (lui-même n'est autrement relâché que
  // par la confirmation d'un webhook, qui n'arrivera jamais puisqu'aucune
  // session n'a été créée). Sans ce correctif, un échec Stripe ponctuel
  // (clé mal configurée, Price ID invalide, erreur réseau...) bloquait
  // silencieusement tout nouvel essai pendant 30 minutes, sans que
  // personne — ni l'utilisateur, ni les logs Stripe (jamais contactés) —
  // ne voie la vraie erreur.
  try {
    let customerId = reservation.existing_customer_id;
    if (!customerId) {
      customerId = await createAndPersistCustomer(stripe, admin, { id: user.id, email: user.email }, log);
    }
    log("5_client_stripe_pret", { customerId });

    let session;
    try {
      session = await stripe.checkout.sessions.create(
        buildSessionParams(customerId, siteUrl, user.id),
      );
      log("6_session_creee", { sessionId: session.id });
    } catch (error) {
      // Prompt 06.17 (correctif) : un `stripe_customer_id` persisté en base
      // peut devenir orphelin — ex. transition d'une clé API de test vers
      // une clé live, un customer supprimé manuellement côté Stripe. Plutôt
      // que de laisser planter tout nouvel essai indéfiniment (l'id invalide
      // resterait en base pour toujours), on détecte précisément ce cas
      // (`resource_missing` sur le paramètre `customer`) et on se
      // rétablit : on efface la référence invalide, on recrée un vrai
      // customer, et on retente UNE fois — jamais de boucle infinie.
      if (!isMissingCustomerError(error)) throw error;

      log("6_session_echec_customer_orphelin", { customerId });
      customerId = await createAndPersistCustomer(stripe, admin, { id: user.id, email: user.email }, log);
      session = await stripe.checkout.sessions.create(
        buildSessionParams(customerId, siteUrl, user.id),
      );
      log("6_session_creee_apres_reparation", { sessionId: session.id, customerId });
    }

    if (!session.url) {
      log("7_session_sans_url");
      await releaseCheckoutLock(admin, user.id, attemptId, log);
      return NextResponse.json(
        { error: "Impossible de créer la session de paiement." },
        { status: 500 },
      );
    }

    log("7_redirection", { url: session.url });
    return NextResponse.redirect(session.url, { status: 303 });
  } catch (error) {
    await releaseCheckoutLock(admin, user.id, attemptId, log);
    const stripeError = error as {
      name?: string;
      message?: string;
      type?: string;
      code?: string;
      statusCode?: number;
      requestId?: string;
    };
    console.error(`[stripe/checkout:${attemptId}] échec de la création de session`, {
      name: stripeError.name,
      message: stripeError.message,
      type: stripeError.type,
      code: stripeError.code,
      statusCode: stripeError.statusCode,
      requestId: stripeError.requestId,
    });
    return NextResponse.json(
      { error: "Impossible de créer la session de paiement. Réessaie dans un instant." },
      { status: 502 },
    );
  }
}

async function releaseCheckoutLock(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  attemptId: string,
  log: (step: string, details?: Record<string, unknown>) => void,
): Promise<void> {
  // Prompt 06.18 (correctif) : le résultat de cette écriture est désormais
  // vérifié — avant, une erreur Supabase ici (RLS, contrainte, coupure
  // réseau momentanée) passait inaperçue, et le verrou restait posé
  // jusqu'à expiration des 30 minutes sans aucune trace dans les logs. La
  // réponse à l'utilisateur ne dépend jamais de ce résultat (best-effort :
  // le verrou expire de toute façon au pire dans 30 minutes), mais
  // l'échec est maintenant toujours visible.
  const { error, data } = await admin
    .from("subscriptions")
    .update({ pending_checkout_at: null })
    .eq("user_id", userId)
    .select("user_id");

  if (error) {
    console.error(`[stripe/checkout:${attemptId}] ÉCHEC DE LIBÉRATION DU VERROU`, {
      userId,
      message: error.message,
      code: error.code,
    });
    return;
  }

  if (!data || data.length === 0) {
    console.error(`[stripe/checkout:${attemptId}] libération du verrou : aucune ligne mise à jour`, {
      userId,
    });
    return;
  }

  log("8_verrou_libere");
}

function buildSessionParams(
  customerId: string,
  siteUrl: string,
  userId: string,
): Stripe.Checkout.SessionCreateParams {
  return {
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: getStripePriceId(), quantity: 1 }],
    success_url: `${siteUrl}/dashboard?upgraded=1`,
    cancel_url: `${siteUrl}/pricing`,
    client_reference_id: userId,
    metadata: { supabase_user_id: userId },
    subscription_data: { metadata: { supabase_user_id: userId } },
  };
}

async function createAndPersistCustomer(
  stripe: Stripe,
  admin: ReturnType<typeof createAdminClient>,
  user: { id: string; email: string },
  log: (step: string, details?: Record<string, unknown>) => void,
): Promise<string> {
  const customerId = (
    await stripe.customers.create({
      email: user.email,
      metadata: { supabase_user_id: user.id },
    })
  ).id;
  log("5_client_stripe_cree", { customerId });

  // Persiste le nouveau customer dès maintenant : évite d'en recréer un
  // autre (orphelin côté Stripe) si l'utilisateur relance un Checkout
  // avant que le webhook de confirmation n'arrive. Un échec ici n'est pas
  // bloquant pour la suite (le webhook renseignera de toute façon ce champ
  // dès qu'il arrivera), mais il est désormais loggé s'il se produit.
  const { error } = await admin
    .from("subscriptions")
    .update({ stripe_customer_id: customerId })
    .eq("user_id", user.id);

  if (error) {
    console.error("[stripe/checkout] échec de la persistance du customer Stripe (non bloquant)", {
      userId: user.id,
      customerId,
      message: error.message,
      code: error.code,
    });
  }

  return customerId;
}

function isMissingCustomerError(error: unknown): boolean {
  const stripeError = error as { code?: string; param?: string } | undefined;
  return stripeError?.code === "resource_missing" && stripeError?.param === "customer";
}

type ReservationResult = { ok: boolean; reason: string; existing_customer_id: string | null };

// Prompt 06.22 (durcissement, suite à une revue de sécurité sur la durée
// maximale RÉELLE de toute la séquence de création Checkout — pas
// seulement un appel Stripe isolé). Âge minimum obligatoire d'un verrou
// avant toute tentative de récupération (voir tryRecoverAbandonedLock).
//
// Analyse de la séquence complète, pas d'un seul appel :
// - Le pire cas de code (customer Stripe persisté orphelin, correctif
//   06.17) enchaîne JUSQU'À 4 appels Stripe séquentiels dans une seule
//   requête : customers.create(), checkout.sessions.create() (échoue),
//   customers.create() à nouveau, checkout.sessions.create() à nouveau —
//   avec des écritures Supabase intercalées entre chacun.
// - Le SDK Stripe (createStripeClient, aucun `maxNetworkRetries` défini)
//   applique sa valeur par défaut : 2 retries automatiques par appel (3
//   tentatives au total), chacune avec son propre timeout de 80 000 ms
//   (vérifié dans node_modules/stripe/{RequestSender,stripe.core}.js) —
//   un simple calcul "80s × 4 appels" sous-estimait donc largement le pire
//   cas théorique en ignorant ces retries.
// - Plutôt que d'essayer de borner ce pire cas théorique (qui peut devenir
//   très large si on l'additionne naïvement — potentiellement plusieurs
//   centaines de secondes dans un scénario pathologique de réseau
//   totalement dégradé), cette route déclare désormais explicitement
//   `export const maxDuration = 120` (ajouté par ce même correctif,
//   cohérent avec les autres routes Stripe/Supabase du projet) : la
//   PLATEFORME elle-même tue la fonction à 120s, qu'importe ce que le SDK
//   est en train de tenter. C'est une garantie bien plus solide qu'un
//   calcul d'estimation : une requête légitime ne peut PHYSIQUEMENT plus
//   tourner au-delà de 120s, point final.
// - Seuil fixé à 3 minutes (180s) = maxDuration (120s) + 60s de marge de
//   sécurité. Avant ce seuil, une requête légitime peut encore être en
//   train de s'exécuter ; après, elle a nécessairement déjà terminé
//   (succès, erreur avec libération via le catch existant 06.15/06.18, ou
//   terminaison forcée par la plateforme à 120s sans avoir pu exécuter son
//   propre nettoyage — c'est CE dernier cas, et lui seul, que cette
//   récupération vise à corriger). Reste très inférieur au délai de 30
//   minutes (reserve_checkout_session, 0022) : la récupération reste
//   nettement plus rapide que l'attente aveugle.
export const MIN_LOCK_AGE_BEFORE_RECOVERY_MS = 3 * 60 * 1000;

// Prompt 06.20 (durcissement, suite à la revue de sécurité du correctif
// 06.19) : au moindre doute sur l'état réel d'un paiement, le verrou est
// CONSERVÉ — jamais l'inverse. Statuts d'abonnement explicitement
// considérés sûrs (tout le reste bloque, y compris un statut futur inconnu
// de Stripe non encore pris en compte ici : liste blanche, pas liste
// noire). `incomplete`/`past_due`/`unpaid` bloquent délibérément : ce sont
// exactement les statuts d'un paiement encore en traitement ou en échec
// avec nouvelle tentative automatique par Stripe.
const SAFE_SUBSCRIPTION_STATUSES = new Set<Stripe.Subscription.Status>(["canceled", "incomplete_expired"]);

// Idem pour les sessions Checkout : seul un paiement confirmé (`paid`) ou
// explicitement sans paiement requis (`no_payment_required`, ex. essai
// gratuit) est sûr. Une session `complete` avec `payment_status: "unpaid"`
// (moyens de paiement asynchrones : virement, certains moyens locaux) n'est
// PAS sûre — le paiement peut encore être en traitement.
const SAFE_SESSION_PAYMENT_STATUSES = new Set<Stripe.Checkout.Session.PaymentStatus>([
  "paid",
  "no_payment_required",
]);

const STRIPE_RECOVERY_PAGE_SIZE = 100;
// Garde-fou anti-boucle infinie / anti-abus : si un customer a plus de
// 1000 sessions ou abonnements, la pagination s'arrête et le résultat est
// traité comme INCERTAIN (donc bloquant) plutôt que de risquer de conclure
// à tort "rien trouvé" en ignorant les pages suivantes.
const STRIPE_RECOVERY_MAX_PAGES = 10;

// Parcourt TOUTES les pages d'une liste Stripe (jamais seulement la
// première) avant de conclure quoi que ce soit. `truncated: true` signifie
// que la pagination a atteint sa limite de sécurité sans avoir fini de
// parcourir les résultats — dans ce cas l'appelant doit considérer l'état
// comme inconnu, jamais comme "rien trouvé".
async function listAllStripePages<T extends { id: string }>(
  fetchPage: (startingAfter?: string) => Promise<{ data: T[]; has_more: boolean }>,
): Promise<{ items: T[]; truncated: boolean }> {
  const items: T[] = [];
  let startingAfter: string | undefined;
  for (let page = 0; page < STRIPE_RECOVERY_MAX_PAGES; page++) {
    const result = await fetchPage(startingAfter);
    items.push(...result.data);
    if (!result.has_more || result.data.length === 0) {
      return { items, truncated: false };
    }
    startingAfter = result.data[result.data.length - 1]?.id;
  }
  return { items, truncated: true };
}

// Prompt 06.19/06.20 : récupération sécurisée d'un verrou `pending_checkout_
// at` abandonné, vérifiée contre l'état RÉEL de Stripe plutôt que d'attendre
// à l'aveugle les 30 minutes d'expiration déjà en place (reserve_checkout_
// session, 0022 — inchangée, toujours le filet de sécurité de dernier
// recours, qui reste le SEUL recours si la vérification ci-dessous ne peut
// pas conclure avec certitude). Ne libère JAMAIS rien si :
// - un abonnement n'est pas dans un statut explicitement sûr (liste
//   blanche ci-dessus — bloque notamment incomplete/past_due/unpaid, pas
//   seulement active/trialing) ;
// - une session Checkout est encore ouverte, OU complétée mais avec un
//   paiement non réglé (moyens de paiement asynchrones) ;
// - la pagination Stripe n'a pas pu être parcourue intégralement ;
// - aucun `stripe_customer_id` n'est connu en base pour ce compte — un
//   `null` ici ne garantit PAS qu'aucun customer Stripe n'existe
//   réellement (createAndPersistCustomer peut créer un customer Stripe
//   réel puis échouer, de façon non bloquante, à persister son id) ;
// - le moindre appel à Stripe échoue pour n'importe quelle raison
//   (fail closed : aucune incertitude n'autorise une libération).
// Retourne le nouveau résultat de réservation si la récupération a réussi
// et que la tentative a pu être retentée, sinon `null` (la réponse
// d'origine — refus — reste inchangée).
async function tryRecoverAbandonedLock(
  stripe: Stripe,
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  existingCustomerId: string | null,
  attemptId: string,
  log: (step: string, details?: Record<string, unknown>) => void,
): Promise<ReservationResult | null> {
  // Prompt 06.20 : jamais de libération automatique sans customer Stripe
  // connu en base — voir la justification ci-dessus. Seul le délai de 30
  // minutes (reserve_checkout_session) peut libérer ce cas précis.
  if (!existingCustomerId) {
    log("4a_recuperation_verrou_ignoree", { reason: "customer_absent_de_supabase" });
    return null;
  }

  // Lecture directe (hors RPC) de la valeur ACTUELLE du verrou : nécessaire
  // comme référence pour le verrou optimiste de release_abandoned_checkout_
  // lock — jamais utilisée pour décider quoi que ce soit d'autre que "y a-t-
  // il encore un verrou à vérifier".
  const { data: current, error: readError } = await admin
    .from("subscriptions")
    .select("pending_checkout_at")
    .eq("user_id", userId)
    .maybeSingle<{ pending_checkout_at: string | null }>();

  if (readError || !current?.pending_checkout_at) {
    log("4a_recuperation_verrou_ignoree", {
      reason: readError ? "lecture_echouee" : "deja_libere",
    });
    return null;
  }

  const pendingCheckoutAt = current.pending_checkout_at;

  // Prompt 06.21/06.22 (durcissement, suite aux revues de sécurité sur les
  // conditions de concurrence puis sur la durée réelle de toute la
  // séquence) : un verrou tout juste posé ne doit JAMAIS être considéré
  // comme "abandonné", même si la recherche Stripe ci-dessous ne trouve
  // rien — la requête qui l'a posé peut tout simplement être encore en
  // train de communiquer avec Stripe (potentiellement plusieurs appels
  // séquentiels, voir la justification complète du seuil au niveau module,
  // MIN_LOCK_AGE_BEFORE_RECOVERY_MS). Chercher "y a-t-il une session ?" à
  // cet instant précis donnerait "non" pour une bonne raison (elle
  // n'existe pas ENCORE) qu'on ne peut pas distinguer d'un verrou
  // réellement abandonné. Seul le TEMPS — borné de façon fiable par
  // `maxDuration`, pas par une estimation du SDK — permet de lever cette
  // ambiguïté.
  const lockAgeMs = Date.now() - new Date(pendingCheckoutAt).getTime();
  if (!Number.isFinite(lockAgeMs) || lockAgeMs < MIN_LOCK_AGE_BEFORE_RECOVERY_MS) {
    log("4a_recuperation_verrou_ignoree", {
      reason: "verrou_trop_recent_possiblement_en_cours",
      lockAgeMs: Number.isFinite(lockAgeMs) ? lockAgeMs : null,
    });
    return null;
  }

  try {
    const [sessionsResult, subscriptionsResult] = await Promise.all([
      listAllStripePages<Stripe.Checkout.Session>((startingAfter) =>
        stripe.checkout.sessions.list({
          customer: existingCustomerId,
          limit: STRIPE_RECOVERY_PAGE_SIZE,
          starting_after: startingAfter,
        }),
      ),
      listAllStripePages<Stripe.Subscription>((startingAfter) =>
        stripe.subscriptions.list({
          customer: existingCustomerId,
          status: "all",
          limit: STRIPE_RECOVERY_PAGE_SIZE,
          starting_after: startingAfter,
        }),
      ),
    ]);

    // Pagination non parcourue intégralement : état inconnu, donc bloquant.
    if (sessionsResult.truncated || subscriptionsResult.truncated) {
      log("4a_recuperation_verrou_refusee", { reason: "pagination_incomplete_incertitude" });
      return null;
    }

    const blockingSession = sessionsResult.items.find(
      (session) =>
        session.status === "open" ||
        (session.status === "complete" &&
          !SAFE_SESSION_PAYMENT_STATUSES.has(session.payment_status)),
    );
    if (blockingSession) {
      log("4a_recuperation_verrou_refusee", {
        reason: "session_stripe_en_cours_ou_impayee",
        sessionId: blockingSession.id,
        status: blockingSession.status,
        paymentStatus: blockingSession.payment_status,
      });
      return null;
    }

    const blockingSubscription = subscriptionsResult.items.find(
      (subscription) => !SAFE_SUBSCRIPTION_STATUSES.has(subscription.status),
    );
    if (blockingSubscription) {
      log("4a_recuperation_verrou_refusee", {
        reason: "abonnement_stripe_non_resolu",
        subscriptionId: blockingSubscription.id,
        status: blockingSubscription.status,
      });
      return null;
    }
  } catch (error) {
    // Fail closed : toute incertitude sur l'état Stripe (réseau, clé API,
    // timeout...) interdit la libération — jamais l'inverse.
    const stripeError = error as { message?: string; type?: string; code?: string };
    console.error(`[stripe/checkout:${attemptId}] échec de la vérification Stripe pour récupération de verrou`, {
      userId,
      message: stripeError.message,
      type: stripeError.type,
      code: stripeError.code,
    });
    return null;
  }

  log("4a_recuperation_verrou_verifiee_stripe", { existingCustomerId });

  const { data: release, error: releaseError } = await admin
    .rpc("release_abandoned_checkout_lock", {
      p_user_id: userId,
      p_expected_pending_checkout_at: pendingCheckoutAt,
    })
    .single<{ released: boolean; reason: string }>();

  if (releaseError || !release?.released) {
    log("4a_recuperation_verrou_echec", {
      reason: releaseError?.message ?? release?.reason,
    });
    return null;
  }

  log("4a_recuperation_verrou_reussie");

  const { data: retry, error: retryError } = await admin
    .rpc("reserve_checkout_session", { p_user_id: userId })
    .single<ReservationResult>();

  if (retryError || !retry) {
    log("4b_reessai_reservation_echec_technique", { error: retryError?.message });
    return null;
  }

  log("4b_reessai_reservation", { ok: retry.ok, reason: retry.reason });
  return retry;
}
