import Link from "next/link";
import {
  FREE_PLAN_COURSE_LIMIT,
  FREE_PLAN_UNLOCKED_CHAPTERS,
  PRO_PLAN_MONTHLY_ANALYSIS_LIMIT,
  PRO_PLAN_MONTHLY_COURSE_LIMIT,
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
          <li className="flex gap-2.5">
            <span className="mt-0.5 text-accent-violet-light">✓</span>
            <span>{FREE_PLAN_COURSE_LIMIT} formation complète générée par Tavyra</span>
          </li>
          <li className="flex gap-2.5">
            <span className="mt-0.5 text-accent-violet-light">✓</span>
            <span>Les {FREE_PLAN_UNLOCKED_CHAPTERS} premiers chapitres en accès libre</span>
          </li>
          <li className="flex gap-2.5">
            <span className="mt-0.5 text-foreground-muted">—</span>
            <span className="text-foreground-muted">Chapitres suivants et quiz verrouillés</span>
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
          <h3 className="text-sm font-semibold uppercase tracking-wide text-accent-violet-light">
            Pro
          </h3>
          <p className="mt-3 text-3xl font-semibold text-foreground">
            {PRO_PLAN_PRICE_EUR.toFixed(2).replace(".", ",")} €
            <span className="text-base font-normal text-foreground-muted"> / mois</span>
          </p>
          <p className="mt-1 text-sm text-foreground-muted">Pour aller plus loin, chaque mois.</p>

          <ul className="mt-6 space-y-3 text-sm text-foreground">
            <li className="flex gap-2.5">
              <span className="mt-0.5 text-accent-violet-light">✓</span>
              <span>{PRO_PLAN_MONTHLY_COURSE_LIMIT} formations générées par mois</span>
            </li>
            <li className="flex gap-2.5">
              <span className="mt-0.5 text-accent-violet-light">✓</span>
              <span>Accès complet à chaque formation, quiz inclus</span>
            </li>
            <li className="flex gap-2.5">
              <span className="mt-0.5 text-accent-violet-light">✓</span>
              <span>Tavyra, ton assistant personnel, sur chaque formation</span>
            </li>
            <li className="flex gap-2.5">
              <span className="mt-0.5 text-accent-violet-light">✓</span>
              <span>{PRO_PLAN_MONTHLY_ANALYSIS_LIMIT} analyses approfondies par mois</span>
            </li>
            <li className="flex gap-2.5">
              <span className="mt-0.5 text-accent-violet-light">✓</span>
              <span>Historique complet de tes formations</span>
            </li>
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
