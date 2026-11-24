import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
import { PRO_PLAN_FEATURES, PRO_PLAN_PRICE_EUR } from "@/lib/courses/plan";
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

      {/* Prompt 06.34 (demande explicite de l'utilisateur : "le bloc de
          paiement [doit être] aligné à gauche au lieu d'être centré... sur
          la version ordinateur", mobile INCHANGÉ à dessein) — tout ce qui
          suit sans préfixe ou avec `sm:` reste strictement identique à
          avant (mobile et tablette, jusqu'à 1024px) : seules les classes
          `lg:` ci-dessous changent quoi que ce soit, et seulement à partir
          de ce seuil. Sous `lg:`, `main` reste une colonne unique centrée,
          exactement comme avant 06.34. */}
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center px-0 pb-0 pt-6 sm:px-6 sm:pt-10 lg:max-w-5xl lg:flex-row lg:items-start lg:justify-between lg:gap-16 lg:px-10 lg:pb-16 lg:pt-16">
        <div className="w-full lg:max-w-md">
          <h1 className="text-center text-xl font-semibold tracking-tight sm:text-3xl lg:text-left">
            Passer au plan Pro
          </h1>
          <p className="mt-1 text-center text-sm text-foreground-muted sm:mt-2 lg:text-left">
            {PRO_PLAN_PRICE_EUR.toFixed(2).replace(".", ",")} € / mois, résiliable à tout moment.
          </p>

          {/* Prompt 06.31 : plus de carte (bordure/fond) autour du formulaire
              — fond de la page déjà blanc (data-theme="light" ci-dessus),
              exactement la même couleur que le formulaire Stripe lui-même :
              une bordure ou un fond légèrement différent créerait de nouveau
              une zone visuellement séparée, l'inverse de l'effet recherché.
              `flex-1` : ce conteneur occupe tout l'espace vertical restant de
              la page, jusqu'en bas de l'écran (mobile/tablette) — le
              formulaire Stripe garde sa propre largeur de confort au centre
              (choix de Stripe, non modifiable depuis cette page — il vit
              dans un iframe cross-origin), mais la page qui l'entoure est
              désormais pleine page, sans aucun vide coloré autour. */}
          <div className="mt-4 flex w-full flex-1 flex-col sm:mt-8">
            <CheckoutClient publishableKey={getStripePublishableKey()} />
          </div>
        </div>

        {/* Prompt 06.34 : panneau récapitulatif, visible uniquement à partir
            de `lg:` — sur un écran d'ordinateur, l'espace laissé vide à
            droite du formulaire (désormais aligné à gauche) par le simple
            retrait du centrage serait lui-même peu professionnel ("rendu
            harmonieux" demandé) ; ce panneau le remplit avec des
            informations réelles et déjà vérifiées (PRO_PLAN_FEATURES,
            seule source de vérité partagée avec /pricing — voir plan.ts —
            jamais un nouveau texte inventé ici). Jamais affiché sur
            mobile/tablette (`hidden lg:block`) : conforme à la consigne de
            ne rien changer sous ce seuil. */}
        <aside className="hidden w-full shrink-0 lg:block lg:w-[320px]">
          <div className="rounded-2xl border border-border-subtle bg-background-elevated/60 p-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
              Plan Pro
            </p>
            <p className="mt-2 text-3xl font-semibold text-foreground">
              {PRO_PLAN_PRICE_EUR.toFixed(2).replace(".", ",")} €
              <span className="text-base font-normal text-foreground-muted"> / mois</span>
            </p>
            <ul className="mt-6 space-y-3 text-sm text-foreground">
              {PRO_PLAN_FEATURES.map((feature) => (
                <li key={feature} className="flex gap-2.5">
                  <span className="mt-0.5 text-accent-violet-light">✓</span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-xs text-foreground-muted">
              Résiliable à tout moment. Paiement sécurisé par Stripe.
            </p>
          </div>
        </aside>
      </main>
    </div>
  );
}
