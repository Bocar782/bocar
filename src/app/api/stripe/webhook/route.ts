import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createStripeClient } from "@/lib/stripe/client";
import { getStripeWebhookSecret } from "@/lib/stripe/env";

export const dynamic = "force-dynamic";

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

  async function upsertFromSubscription(subscription: Stripe.Subscription) {
    const userId = subscription.metadata?.supabase_user_id;
    if (!userId) return;

    const currentPeriodEnd = subscription.items.data[0]?.current_period_end;

    await admin.from("subscriptions").upsert(
      {
        user_id: userId,
        stripe_customer_id: subscription.customer as string,
        stripe_subscription_id: subscription.id,
        status: subscription.status,
        current_period_end: currentPeriodEnd
          ? new Date(currentPeriodEnd * 1000).toISOString()
          : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      if (session.mode === "subscription" && session.subscription) {
        const subscription = await stripe.subscriptions.retrieve(
          session.subscription as string,
        );
        await upsertFromSubscription(subscription);
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      await upsertFromSubscription(event.data.object);
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
