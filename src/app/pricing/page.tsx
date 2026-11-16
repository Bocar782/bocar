import Link from "next/link";
import { BackgroundGlow } from "@/components/background-glow";
import { BrandMark } from "@/components/brand-mark";
import {
  FREE_PLAN_FEATURES,
  FREE_PLAN_LIMITATION,
  isOnFreePlan,
  PRO_PLAN_FEATURES,
  PRO_PLAN_PRICE_EUR,
} from "@/lib/courses/plan";
import { createClient } from "@/lib/supabase/server";

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

        <div className="mt-12 grid w-full gap-6 sm:grid-cols-2">
          <div className="rounded-[28px] border border-border-subtle bg-white/[0.02] p-6 sm:p-8">
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
              <Link
                href="/signup"
                className="mt-8 block rounded-full border border-border-subtle bg-white/5 px-5 py-2.5 text-center text-sm font-medium text-foreground backdrop-blur transition-colors hover:bg-white/10"
              >
                Commencer gratuitement
              </Link>
            ) : (
              <div className="mt-8 rounded-full border border-border-subtle bg-white/[0.03] px-5 py-2.5 text-center text-sm text-foreground-muted">
                {onFreePlan ? "Ton plan actuel" : "Plan précédent"}
              </div>
            )}
          </div>

          <div className="relative rounded-[28px] p-px">
            <div
              aria-hidden
              className="absolute inset-0 rounded-[28px] bg-gradient-to-br from-accent-blue/50 via-white/10 to-accent-violet/50"
            />
            <div className="relative h-full rounded-[28px] bg-background-elevated/95 p-6 sm:p-8">
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
                <Link
                  href="/login"
                  className="mt-8 block rounded-full bg-gradient-to-r from-accent-blue to-accent-violet px-5 py-2.5 text-center text-sm font-semibold text-white shadow-[0_8px_30px_-8px_var(--accent-violet)] transition-all hover:brightness-110"
                >
                  Se connecter pour s&apos;abonner
                </Link>
              )}
              {user && onFreePlan && (
                <form action="/api/stripe/checkout" method="POST">
                  <button
                    type="submit"
                    className="mt-8 w-full rounded-full bg-gradient-to-r from-accent-blue to-accent-violet px-5 py-2.5 text-center text-sm font-semibold text-white shadow-[0_8px_30px_-8px_var(--accent-violet)] transition-all hover:brightness-110"
                  >
                    S&apos;abonner
                  </button>
                </form>
              )}
              {user && !onFreePlan && (
                <div className="mt-8 space-y-2">
                  <div className="rounded-full border border-accent-violet/30 bg-accent-violet/10 px-5 py-2.5 text-center text-sm text-accent-violet-light">
                    Ton plan actuel
                  </div>
                  <form action="/api/stripe/portal" method="POST">
                    <button
                      type="submit"
                      className="w-full rounded-full border border-border-subtle bg-white/5 px-5 py-2.5 text-center text-sm font-medium text-foreground backdrop-blur transition-colors hover:bg-white/10"
                    >
                      Gérer mon abonnement
                    </button>
                  </form>
                </div>
              )}
            </div>
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
