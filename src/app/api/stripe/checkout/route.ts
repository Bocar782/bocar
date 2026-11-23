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

// Prompt 06.19 : récupération sécurisée d'un verrou `pending_checkout_at`
// abandonné, vérifiée contre l'état RÉEL de Stripe plutôt que d'attendre
// à l'aveugle les 30 minutes d'expiration déjà en place (reserve_checkout_
// session, 0022 — inchangée, toujours le filet de sécurité de dernier
// recours). Ne libère JAMAIS rien si :
// - un abonnement est actif/trialing (vérifié par release_abandoned_
//   checkout_lock elle-même, en plus de reserve_checkout_session) ;
// - une session Checkout Stripe est encore réellement ouverte pour ce
//   customer ;
// - un abonnement Stripe actif/trialing existe pour ce customer mais n'a
//   pas encore été synchronisé par le webhook ;
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

  // Aucun customer Stripe n'existe encore pour ce compte : aucune session
  // Checkout ni aucun abonnement ne peut donc exister côté Stripe — pas
  // besoin de les interroger, la libération est sûre par construction.
  if (existingCustomerId) {
    try {
      const [openSessions, subscriptions] = await Promise.all([
        stripe.checkout.sessions.list({ customer: existingCustomerId, status: "open", limit: 5 }),
        stripe.subscriptions.list({ customer: existingCustomerId, status: "all", limit: 10 }),
      ]);

      if (openSessions.data.length > 0) {
        log("4a_recuperation_verrou_refusee", {
          reason: "session_stripe_ouverte",
          sessionId: openSessions.data[0]?.id,
        });
        return null;
      }

      const activeSubscription = subscriptions.data.find(
        (subscription) => subscription.status === "active" || subscription.status === "trialing",
      );
      if (activeSubscription) {
        log("4a_recuperation_verrou_refusee", {
          reason: "abonnement_stripe_actif_non_synchronise",
          subscriptionId: activeSubscription.id,
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
