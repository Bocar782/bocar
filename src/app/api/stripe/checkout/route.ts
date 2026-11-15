import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createStripeClient } from "@/lib/stripe/client";
import { getStripePriceId } from "@/lib/stripe/env";
import { getSiteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

// Crée une session Stripe Checkout (abonnement Pro) et redirige l'utilisateur
// vers la page de paiement hébergée par Stripe.
export async function POST() {
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

  // Réutilise le customer Stripe existant s'il y en a déjà un (ex. un
  // précédent abonnement résilié), pour éviter les doublons.
  const { data: existing } = await admin
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const customerId =
    existing?.stripe_customer_id ??
    (
      await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      })
    ).id;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: getStripePriceId(), quantity: 1 }],
    success_url: `${siteUrl}/dashboard?upgraded=1`,
    cancel_url: `${siteUrl}/tarifs`,
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
