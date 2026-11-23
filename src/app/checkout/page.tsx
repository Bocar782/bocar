import Link from "next/link";
import { redirect } from "next/navigation";
import { BackgroundGlow } from "@/components/background-glow";
import { BrandMark } from "@/components/brand-mark";
import { Card } from "@/components/ui/card";
import { PRO_PLAN_PRICE_EUR } from "@/lib/courses/plan";
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
//
// Mise en page (même structure qu'une page publique, ex. pricing/page.tsx) :
// avant ce correctif, /checkout n'avait ni fond ni en-tête ni largeur
// contrôlée — le formulaire Stripe (déjà responsive par lui-même)
// apparaissait minuscule au milieu d'un grand vide, illisible sur un écran
// d'ordinateur. Ce composant serveur fournit le même cadre que le reste du
// site (BackgroundGlow, en-tête avec logo + lien de retour, largeur
// maximale centrée) ; CheckoutClient ne gère plus que le formulaire
// lui-même et son propre état de chargement/erreur.
export default async function CheckoutPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="relative flex min-h-screen flex-1 flex-col">
      <BackgroundGlow />

      <header className="relative z-10 flex items-center justify-between px-6 py-6 sm:px-10">
        <Link href="/dashboard" className="flex items-center gap-2">
          <BrandMark size={32} />
          <span className="text-lg font-semibold tracking-tight">Tavyra</span>
        </Link>
        <Link
          href="/pricing"
          className="text-sm text-foreground-muted transition-colors hover:text-foreground"
        >
          Retour aux tarifs
        </Link>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-0 pb-6 pt-2 sm:px-6 sm:pb-16 sm:pt-6">
        <h1 className="text-center text-xl font-semibold tracking-tight sm:text-3xl">
          Passer au plan Pro
        </h1>
        <p className="mt-1 text-center text-sm text-foreground-muted sm:mt-2">
          {PRO_PLAN_PRICE_EUR.toFixed(2).replace(".", ",")} € / mois, résiliable à tout moment.
        </p>

        {/* Prompt 06.28 (ajustement) : le formulaire Stripe lui-même garde
            toujours une largeur de contenu modeste (choix volontaire de
            Stripe pour la lisibilité d'un formulaire de paiement, non
            modifiable depuis cette page — il vit dans un iframe cross-
            origin). Ce cadre (Card pleine largeur, sans marge latérale sur
            mobile) occupe en revanche tout l'espace disponible, pour ne
            jamais laisser de grand vide autour : visuellement "rempli" sur
            toutes les tailles d'écran, même si le formulaire Stripe garde
            sa propre largeur de confort au centre. */}
        <div className="mt-4 w-full sm:mt-8">
          <Card padding="sm" className="w-full rounded-none sm:rounded-2xl">
            <CheckoutClient publishableKey={getStripePublishableKey()} />
          </Card>
        </div>
      </main>
    </div>
  );
}
