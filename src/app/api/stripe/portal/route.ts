import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createStripeClient } from "@/lib/stripe/client";
import { getSiteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

// Ouvre le portail client Stripe (factures, moyen de paiement, résiliation)
// pour l'abonnement de l'utilisateur connecté.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: subscription } = await admin
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!subscription?.stripe_customer_id) {
    return NextResponse.json(
      { error: "Aucun abonnement Stripe trouvé pour ce compte." },
      { status: 404 },
    );
  }

  const stripe = createStripeClient();
  const session = await stripe.billingPortal.sessions.create({
    customer: subscription.stripe_customer_id,
    return_url: `${getSiteUrl()}/dashboard`,
  });

  return NextResponse.redirect(session.url, { status: 303 });
}
