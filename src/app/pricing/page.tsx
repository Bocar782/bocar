import Link from "next/link";
import { BackgroundGlow } from "@/components/background-glow";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Faq } from "@/components/marketing/faq";
import { FAQ_ITEMS } from "@/components/marketing/faq-data";
import {
  EXPERT_PLAN_PRICE_EUR,
  FREE_PLAN_FEATURES,
  FREE_PLAN_LIMITATION,
  isOnFreePlan,
  PRO_PLAN_FEATURES,
  PRO_PLAN_PRICE_EUR,
} from "@/lib/courses/plan";
import { createClient } from "@/lib/supabase/server";

// Prompt 05.28 : sous-ensemble volontairement court (5 sur 9) des vraies
// questions de faq-data.ts — "pas trop longue", pas de contenu inventé.
const PRICING_FAQ_QUESTIONS = new Set([
  "Comment fonctionne Tavyra ?",
  "Quels sujets puis-je apprendre ?",
  "Comment fonctionnent les quiz ?",
  "Puis-je annuler mon abonnement ?",
  "Puis-je utiliser Tavyra sur téléphone ?",
]);
const PRICING_FAQ_ITEMS = FAQ_ITEMS.filter((item) => PRICING_FAQ_QUESTIONS.has(item.question));

export default async function PricingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const onFreePlan = user ? await isOnFreePlan(supabase, user.id) : true;

  return (
    <div className="relative flex min-h-screen flex-1 flex-col">
      <BackgroundGlow />

      <header className="relative z-10 flex items-center justify-between px-6 py-6 sm:px-10">
        <Link href={user ? "/dashboard" : "/"} className="flex items-center gap-2">
          <BrandMark size={32} />
          <span className="text-lg font-semibold tracking-tight">Tavyra</span>
        </Link>
        {!user && (
          <Link
            href="/login"
            className="text-sm text-foreground-muted transition-colors hover:text-foreground"
          >
            Connexion
          </Link>
        )}
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-6 pb-24 pt-8 sm:pt-16">
        <h1 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">
          Des tarifs simples
        </h1>
        <p className="mt-3 max-w-md text-center text-sm text-foreground-muted">
          Commence gratuitement, débloque la suite quand tu es prêt à aller
          plus loin.
        </p>

        <div className="mt-12 grid w-full gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Card padding="md">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground-muted">
              Gratuit
            </h2>
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
            <h2 className="text-sm font-semibold uppercase tracking-wide text-accent-violet-light">
              Pro
            </h2>
            <p className="mt-3 text-3xl font-semibold text-foreground">
              {PRO_PLAN_PRICE_EUR.toFixed(2).replace(".", ",")} €
              <span className="text-base font-normal text-foreground-muted"> / mois</span>
            </p>
            <p className="mt-1 text-sm text-foreground-muted">
              Pour aller plus loin, chaque mois.
            </p>

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
            {user && onFreePlan && (
              <form action="/api/stripe/checkout" method="POST">
                <Button type="submit" fullWidth className="mt-8">
                  S&apos;abonner
                </Button>
              </form>
            )}
            {user && !onFreePlan && (
              <div className="mt-8 space-y-2">
                <div className="rounded-full border border-accent-violet/30 bg-accent-violet/10 px-5 py-2.5 text-center text-sm text-accent-violet-light">
                  Ton plan actuel
                </div>
                <form action="/api/stripe/portal" method="POST">
                  <Button type="submit" variant="secondary" fullWidth>
                    Gérer mon abonnement
                  </Button>
                </form>
              </div>
            )}
          </Card>

          {/* Prompt 05.28 : offre affichée uniquement — aucun prix Stripe
              ni entitlement réel derrière pour l'instant (voir plan.ts),
              donc bouton désactivé plutôt qu'un faux appel à l'action. */}
          <Card className="relative h-full opacity-90">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground-muted">
              Expert
            </h2>
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

        {/* FAQ — Prompt 05.28, sous-ensemble court des vraies questions */}
        <div className="mt-20 w-full">
          <h2 className="text-center text-2xl font-semibold tracking-tight text-foreground">
            Questions fréquentes
          </h2>
          <div className="mt-8">
            <Faq items={PRICING_FAQ_ITEMS} />
          </div>
        </div>

        <p className="mt-10 text-sm text-foreground-muted">
          <Link
            href={user ? "/dashboard" : "/"}
            className="underline underline-offset-2 hover:text-foreground"
          >
            {user ? "← Retour au tableau de bord" : "← Retour à l'accueil"}
          </Link>
        </p>
      </main>
    </div>
  );
}
