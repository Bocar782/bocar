import { NextResponse } from "next/server";
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
  const originError = checkRequestOrigin(request);
  if (originError) return originError;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

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
  const { data: reservation, error: reservationError } = await admin
    .rpc("reserve_checkout_session", { p_user_id: user.id })
    .single<{ ok: boolean; reason: string; existing_customer_id: string | null }>();

  if (reservationError || !reservation) {
    return NextResponse.json(
      { error: "Impossible de vérifier ton abonnement pour le moment. Réessaie dans un instant." },
      { status: 503 },
    );
  }

  if (!reservation.ok) {
    const message =
      reservation.reason === "already_pro"
        ? "Tu as déjà un abonnement Pro actif."
        : "Une session de paiement est déjà en cours pour ce compte. Réessaie dans quelques instants.";
    return NextResponse.json({ error: message }, { status: 409 });
  }

  let customerId = reservation.existing_customer_id;
  if (!customerId) {
    customerId = (
      await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      })
    ).id;
    // Persiste le nouveau customer dès maintenant : évite d'en recréer un
    // autre (orphelin côté Stripe) si l'utilisateur relance un Checkout
    // avant que le webhook de confirmation n'arrive. Un échec ici n'est
    // pas bloquant : le webhook renseignera de toute façon ce champ dès
    // qu'il arrivera.
    await admin.from("subscriptions").update({ stripe_customer_id: customerId }).eq("user_id", user.id);
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: getStripePriceId(), quantity: 1 }],
    success_url: `${siteUrl}/dashboard?upgraded=1`,
    cancel_url: `${siteUrl}/pricing`,
    client_reference_id: user.id,
    metadata: { supabase_user_id: user.id },
    subscription_data: { metadata: { supabase_user_id: user.id } },
  });

  if (!session.url) {
    return NextResponse.json(
      { error: "Impossible de créer la session de paiement." },
      { status: 500 },
    );
  }

  return NextResponse.redirect(session.url, { status: 303 });
}
