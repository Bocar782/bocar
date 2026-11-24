import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
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
// Mise en page (Prompt 06.31, suite à un signalement utilisateur réel sur
// capture d'écran : le fond violet/sombre du reste du site (BackgroundGlow)
// restait visible tout autour du formulaire Stripe, lui-même blanc — rendu
// perçu comme "pas rempli", pas comme une vraie page de paiement pleine
// page). Plus de BackgroundGlow ici, et `data-theme="light"` posé
// directement sur la racine (mêmes jetons de couleur blancs que l'intérieur
// de l'app en thème clair, voir globals.css/[data-theme="light"] et
// theme-context.tsx) : toute la page est désormais blanche, comme le
// formulaire Stripe lui-même — plus aucun violet visible nulle part, sur
// mobile comme sur ordinateur. Indépendant de la préférence de thème de
// l'intérieur de l'app (localStorage, theme-context.tsx) : cette page n'est
// pas rendue par DashboardShell, donc toujours blanche, par choix délibéré
// pour cette page précise.
export default async function CheckoutPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div data-theme="light" className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border-subtle px-6 py-4 sm:px-10">
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

      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center px-0 pb-0 pt-6 sm:px-6 sm:pt-10">
        <h1 className="text-center text-xl font-semibold tracking-tight sm:text-3xl">
          Passer au plan Pro
        </h1>
        <p className="mt-1 text-center text-sm text-foreground-muted sm:mt-2">
          {PRO_PLAN_PRICE_EUR.toFixed(2).replace(".", ",")} € / mois, résiliable à tout moment.
        </p>

        {/* Prompt 06.31 : plus de carte (bordure/fond) autour du formulaire
            — fond de la page déjà blanc (data-theme="light" ci-dessus),
            exactement la même couleur que le formulaire Stripe lui-même :
            une bordure ou un fond légèrement différent créerait de nouveau
            une zone visuellement séparée, l'inverse de l'effet recherché.
            `flex-1` : ce conteneur occupe tout l'espace vertical restant de
            la page, jusqu'en bas de l'écran — le formulaire Stripe garde sa
            propre largeur de confort au centre (choix de Stripe, non
            modifiable depuis cette page — il vit dans un iframe cross-
            origin), mais la page qui l'entoure est désormais pleine page,
            sans aucun vide coloré autour. */}
        <div className="mt-4 flex w-full flex-1 flex-col sm:mt-8">
          <CheckoutClient publishableKey={getStripePublishableKey()} />
        </div>
      </main>
    </div>
  );
}
