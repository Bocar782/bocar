import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStripePublishableKey } from "@/lib/stripe/env";
import { CheckoutClient } from "./checkout-client";

// Prompt 06.28 : même garde d'authentification que les autres pages privées
// (ex. /dashboard) — `CheckoutClient` (composant client, nécessaire pour
// Stripe.js/Elements) ne peut pas faire cette vérification serveur
// elle-même, donc ce composant serveur la fait avant de la monter. Lit
// aussi la clé publique Stripe ici (process.env, sans préfixe
// NEXT_PUBLIC_) et la passe en prop — évite de dépendre d'une variable
// d'environnement NEXT_PUBLIC_* supplémentaire à ajouter en production.
export default async function CheckoutPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <CheckoutClient publishableKey={getStripePublishableKey()} />;
}
