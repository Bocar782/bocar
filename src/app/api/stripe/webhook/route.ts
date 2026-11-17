import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createStripeClient } from "@/lib/stripe/client";
import { getStripeWebhookSecret } from "@/lib/stripe/env";

export const dynamic = "force-dynamic";

type SyncResult = { applied: boolean; duplicate: boolean; reason: string };

/**
 * Synchronise Supabase avec l'état ACTUEL d'un abonnement Stripe (Prompt
 * 05.17.3, correction des failles de fiabilité de l'audit 05.17).
 *
 * `subscription` doit TOUJOURS provenir d'un `stripe.subscriptions.retrieve()`
 * fait juste avant cet appel — jamais de l'objet embarqué dans l'événement
 * webhook, qui peut être périmé si Stripe livre les événements dans le
 * désordre (non garanti). Le RPC `sync_stripe_subscription`
 * (0022_stripe_reliability.sql) applique en plus un verrou de version
 * atomique basé sur `event.created` : une écriture dont l'événement est
 * antérieur au dernier déjà appliqué pour cet utilisateur est rejetée côté
 * base de données, qu'importe l'ordre réel d'arrivée de CETTE requête HTTP.
 * C'est la combinaison des deux (relecture Stripe + verrou de version) qui
 * protège contre le désordre, pas l'une des deux seule.
 */
async function syncSubscriptionFromStripe(
  admin: SupabaseClient,
  event: Stripe.Event,
  subscription: Stripe.Subscription,
): Promise<{ ok: true; result: SyncResult } | { ok: false }> {
  const userId = subscription.metadata?.supabase_user_id;
  if (!userId) {
    // Ne jamais associer arbitrairement cet abonnement à un utilisateur, et
    // ne jamais ignorer silencieusement ce cas : il signale un problème
    // réel côté création de l'abonnement (metadata manquante) qu'un simple
    // retry Stripe ne peut pas corriger — d'où un 200 (rien à réessayer),
    // mais avec un log explicite pour investigation. Aucune donnée
    // sensible (email, moyen de paiement) dans ce log : uniquement des
    // identifiants Stripe opaques.
    console.error(
      "Webhook Stripe : abonnement sans metadata.supabase_user_id — ignoré, aucune association arbitraire.",
      {
        eventId: event.id,
        eventType: event.type,
        stripeCustomerId: typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id,
        stripeSubscriptionId: subscription.id,
      },
    );
    return { ok: true, result: { applied: false, duplicate: false, reason: "missing_user_id" } };
  }

  const item = subscription.items.data[0];
  const currentPeriodStart = item?.current_period_start;
  const currentPeriodEnd = item?.current_period_end;

  const { data, error } = await admin
    .rpc("sync_stripe_subscription", {
      p_event_id: event.id,
      p_event_type: event.type,
      p_event_created: event.created,
      p_user_id: userId,
      p_customer_id: typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id ?? null,
      p_subscription_id: subscription.id,
      p_status: subscription.status,
      p_current_period_start: currentPeriodStart
        ? new Date(currentPeriodStart * 1000).toISOString()
        : null,
      p_current_period_end: currentPeriodEnd
        ? new Date(currentPeriodEnd * 1000).toISOString()
        : null,
      p_cancel_at_period_end: subscription.cancel_at_period_end,
    })
    .single<SyncResult>();

  if (error || !data) {
    // Échec réel de l'écriture Supabase (panne, réseau, etc.) : Stripe doit
    // réessayer — jamais confirmer un événement comme traité dans ce cas.
    // Le détail de l'erreur reste dans les logs serveur uniquement.
    console.error("Webhook Stripe : échec de la synchronisation Supabase.", {
      eventId: event.id,
      eventType: event.type,
      errorMessage: error?.message,
    });
    return { ok: false };
  }

  return { ok: true, result: data };
}

// Synchronise le statut d'abonnement (table `subscriptions`) avec Stripe.
// Doit rester accessible sans authentification Supabase : Stripe appelle
// cette route directement, l'identité est garantie par la signature.
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Signature manquante." }, { status: 400 });
  }

  const stripe = createStripeClient();
  const body = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, getStripeWebhookSecret());
  } catch (err) {
    const message = err instanceof Error ? err.message : "Signature invalide.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const admin = createAdminClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.mode === "subscription" && session.subscription) {
          const subscriptionId =
            typeof session.subscription === "string" ? session.subscription : session.subscription.id;
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const sync = await syncSubscriptionFromStripe(admin, event, subscription);
          if (!sync.ok) {
            return NextResponse.json({ error: "Échec de la synchronisation." }, { status: 500 });
          }
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        // Relit TOUJOURS l'état actuel depuis Stripe — jamais
        // `event.data.object` directement, qui peut être périmé en cas de
        // livraison dans le désordre (voir le commentaire de
        // syncSubscriptionFromStripe ci-dessus). Un abonnement supprimé
        // reste normalement récupérable chez Stripe (status 'canceled').
        const subscription = await stripe.subscriptions.retrieve(event.data.object.id);
        const sync = await syncSubscriptionFromStripe(admin, event, subscription);
        if (!sync.ok) {
          return NextResponse.json({ error: "Échec de la synchronisation." }, { status: 500 });
        }
        break;
      }
      case "invoice.payment_failed": {
        // L'accès Pro est déjà révoqué via customer.subscription.updated
        // (Stripe fait passer le statut à 'past_due'/'unpaid', jamais
        // accepté par isOnFreePlan/getActiveSubscription) : ce cas ne fait
        // qu'enregistrer un log exploitable, sans aucune donnée bancaire
        // ni personnelle — uniquement des identifiants Stripe opaques et
        // le nombre de tentatives.
        const invoice = event.data.object;
        const subscriptionRef = invoice.parent?.subscription_details?.subscription;
        console.error("Webhook Stripe : paiement échoué.", {
          eventId: event.id,
          invoiceId: invoice.id,
          customerId: typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id,
          subscriptionId: typeof subscriptionRef === "string" ? subscriptionRef : subscriptionRef?.id ?? null,
          attemptCount: invoice.attempt_count,
        });
        break;
      }
      default:
        break;
    }
  } catch (err) {
    // Erreur inattendue (ex. l'API Stripe elle-même est indisponible) :
    // mieux vaut laisser Stripe réessayer que de confirmer un événement
    // qu'on n'a pas réellement pu traiter.
    console.error("Webhook Stripe : erreur inattendue pendant le traitement.", {
      eventId: event.id,
      eventType: event.type,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Erreur inattendue." }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
