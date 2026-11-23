import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StripeSubmitForm } from "@/components/marketing/stripe-submit-form";
import {
  EXPERT_PLAN_PRICE_EUR,
  FREE_PLAN_FEATURES,
  FREE_PLAN_LIMITATION,
  PRO_PLAN_FEATURES,
  PRO_PLAN_PRICE_EUR,
} from "@/lib/courses/plan";

// Prompt 05.31 : factorisé depuis pricing/page.tsx pour que la landing
// (nouvelle section Tarifs) et /pricing affichent EXACTEMENT les mêmes
// offres, avec le même comportement selon l'état de connexion — jamais
// deux versions qui pourraient diverger. `user`/`onFreePlan` sont calculés
// une fois par la page appelante (Server Component, lecture Supabase).
export function PricingCards({
  user,
  onFreePlan,
}: {
  user: { id: string } | null;
  onFreePlan: boolean;
}) {
  return (
    <div className="grid w-full gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <Card padding="md">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground-muted">
          Gratuit
        </h3>
        <p className="mt-3 text-3xl font-semibold text-foreground">0 €</p>
        <p className="mt-1 text-sm text-foreground-muted">
          Pour découvrir Tavyra sans engagement.
        </p>

        <ul className="mt-6 space-y-3 text-sm text-foreground">
          {FREE_PLAN_FEATURES.map((feature) => (
            <li key={feature} className="flex gap-2.5">
              <span className="mt-0.5 text-accent-violet-light">✓</span>
              <span>{feature}</span>
            </li>
          ))}
          <li className="flex gap-2.5">
            <span className="mt-0.5 text-foreground-muted">—</span>
            <span className="text-foreground-muted">{FREE_PLAN_LIMITATION}</span>
          </li>
        </ul>

        {!user ? (
          <Button href="/signup" variant="secondary" fullWidth className="mt-8">
            Commencer gratuitement
          </Button>
        ) : (
          <div className="mt-8 rounded-full border border-border-subtle bg-white/[0.03] px-5 py-2.5 text-center text-sm text-foreground-muted">
            {onFreePlan ? "Ton plan actuel" : "Plan précédent"}
          </div>
        )}
      </Card>

      <Card variant="elevated" className="relative h-full">
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-accent-blue to-accent-violet px-3.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white shadow-[0_4px_20px_-4px_var(--accent-violet)]">
          Recommandé
        </span>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-accent-violet-light">
          Pro
        </h3>
        <p className="mt-3 text-3xl font-semibold text-foreground">
          {PRO_PLAN_PRICE_EUR.toFixed(2).replace(".", ",")} €
          <span className="text-base font-normal text-foreground-muted"> / mois</span>
        </p>
        <p className="mt-1 text-sm text-foreground-muted">Pour aller plus loin, chaque mois.</p>

        <ul className="mt-6 space-y-3 text-sm text-foreground">
          {PRO_PLAN_FEATURES.map((feature) => (
            <li key={feature} className="flex gap-2.5">
              <span className="mt-0.5 text-accent-violet-light">✓</span>
              <span>{feature}</span>
            </li>
          ))}
        </ul>

        {!user && (
          <Button href="/login" fullWidth className="mt-8">
            Se connecter pour s&apos;abonner
          </Button>
        )}
        {/* Prompt 06.28 : simple navigation vers /checkout (paiement intégré
            sur ce site), plus de soumission directe vers /api/stripe/checkout
            — cette route ne redirige plus (voir route.ts, ui_mode: "embedded"). */}
        {user && onFreePlan && (
          <Button href="/checkout" fullWidth className="mt-8">
            S&apos;abonner
          </Button>
        )}
        {user && !onFreePlan && (
          <div className="mt-8 space-y-2">
            <div className="rounded-full border border-accent-violet/30 bg-accent-violet/10 px-5 py-2.5 text-center text-sm text-accent-violet-light">
              Ton plan actuel
            </div>
            <StripeSubmitForm action="/api/stripe/portal" variant="secondary" fullWidth>
              Gérer mon abonnement
            </StripeSubmitForm>
          </div>
        )}
      </Card>

      {/* Affichage seul — aucun prix Stripe ni entitlement réel pour
          l'instant (voir plan.ts), donc bouton désactivé plutôt qu'un
          faux appel à l'action. */}
      <Card className="relative h-full opacity-90">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground-muted">
          Expert
        </h3>
        <p className="mt-3 text-3xl font-semibold text-foreground">
          {EXPERT_PLAN_PRICE_EUR.toFixed(2).replace(".", ",")} €
          <span className="text-base font-normal text-foreground-muted"> / mois</span>
        </p>
        <p className="mt-1 text-sm text-foreground-muted">
          Pour aller encore plus loin — fonctionnalités bientôt détaillées.
        </p>

        <p className="mt-6 text-sm text-foreground-muted">
          Les avantages de cette offre seront précisés avant son ouverture.
        </p>

        <Button disabled fullWidth className="mt-8">
          Bientôt disponible
        </Button>
      </Card>
    </div>
  );
}
