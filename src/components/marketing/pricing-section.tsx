import Link from "next/link";
import {
  FREE_PLAN_FEATURES,
  FREE_PLAN_LIMITATION,
  PRO_PLAN_FEATURES,
  PRO_PLAN_PRICE_EUR,
} from "@/lib/courses/plan";

export function PricingSection() {
  return (
    <div className="grid w-full gap-6 sm:grid-cols-2">
      <div className="rounded-[28px] border border-border-subtle bg-white/[0.02] p-6 sm:p-8">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-foreground-muted">
          Gratuit
        </h3>
        <p className="mt-3 text-3xl font-semibold text-foreground">0 €</p>
        <p className="mt-1 text-sm text-foreground-muted">Pour découvrir Tavyra sans engagement.</p>

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

        <Link
          href="/signup"
          className="mt-8 block rounded-full border border-border-subtle bg-white/5 px-5 py-2.5 text-center text-sm font-medium text-foreground backdrop-blur transition-colors hover:bg-white/10"
        >
          Commencer gratuitement
        </Link>
      </div>

      <div className="relative rounded-[28px] p-px">
        <div
          aria-hidden
          className="absolute inset-0 rounded-[28px] bg-gradient-to-br from-accent-blue/50 via-white/10 to-accent-violet/50"
        />
        <div className="relative h-full rounded-[28px] bg-background-elevated/95 p-6 sm:p-8">
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

          <Link
            href="/signup"
            className="mt-8 block rounded-full bg-gradient-to-r from-accent-blue to-accent-violet px-5 py-2.5 text-center text-sm font-semibold text-white shadow-[0_8px_30px_-8px_var(--accent-violet)] transition-all hover:brightness-110"
          >
            Commencer avec Pro
          </Link>
        </div>
      </div>
    </div>
  );
}
