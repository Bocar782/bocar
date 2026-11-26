import Image from "next/image";
import { Button } from "@/components/ui/button";
import { TESTIMONIALS } from "@/components/marketing/testimonials";
import {
  FREE_PLAN_FEATURES,
  FREE_PLAN_LIMITATION,
  PRO_PLAN_FEATURES,
  PRO_PLAN_PRICE_EUR,
} from "@/lib/courses/plan";

// Comparatif Gratuit / Pro + deux vrais avis (mêmes textes que la landing,
// jamais inventés) affichés aux comptes gratuits sur la page de création.
const QUOTED = TESTIMONIALS.filter((t) => t.name === "Camille" || t.name === "Ibrahim");

function Check() {
  return (
    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-violet/20 text-[11px] text-accent-violet-light">
      ✓
    </span>
  );
}

export function ProUpsellPanel() {
  const price = PRO_PLAN_PRICE_EUR.toFixed(2).replace(".", ",");
  return (
    <section className="rise relative w-full overflow-hidden rounded-[28px] border border-accent-violet/25 bg-background-card/80 p-6 sm:p-8">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-28 left-1/2 h-56 w-[28rem] -translate-x-1/2 rounded-full bg-accent-violet/25 blur-3xl"
      />
      <div className="relative text-center">
        <span className="bg-brand inline-flex rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
          Plan Pro
        </span>
        <h2 className="mt-3 text-balance text-2xl font-semibold tracking-tight text-foreground">
          Va au bout de ta formation
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-foreground-muted">
          Le diagnostic est gratuit. Avec Pro, Tavyra rédige ta formation complète et tu y as
          accès sans restriction.
        </p>
      </div>

      <div className="relative mt-7 grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-border-subtle bg-overlay/[0.02] p-5">
          <p className="text-sm font-semibold uppercase tracking-wide text-foreground-muted">
            Gratuit
          </p>
          <ul className="mt-4 space-y-2.5 text-sm">
            {FREE_PLAN_FEATURES.map((f) => (
              <li key={f} className="flex gap-2.5 text-foreground-muted">
                <Check />
                {f}
              </li>
            ))}
            <li className="flex gap-2.5 text-foreground-muted/70">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">—</span>
              {FREE_PLAN_LIMITATION}
            </li>
          </ul>
        </div>

        <div className="spin-border rounded-2xl">
          <div className="h-full rounded-2xl bg-background-elevated p-5">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-semibold uppercase tracking-wide text-accent-violet-light">
                Pro
              </p>
              <p className="text-lg font-semibold text-foreground">
                {price} €<span className="text-xs font-normal text-foreground-muted"> / mois</span>
              </p>
            </div>
            <ul className="mt-4 space-y-2.5 text-sm">
              {PRO_PLAN_FEATURES.map((f) => (
                <li key={f} className="flex gap-2.5 text-foreground">
                  <Check />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="relative mt-6 grid gap-3 md:grid-cols-2">
        {QUOTED.map((t) => (
          <figure
            key={t.name}
            className="flex gap-3 rounded-2xl border border-border-subtle bg-overlay/[0.02] p-4"
          >
            <Image
              src={t.photo}
              alt=""
              width={36}
              height={36}
              className="h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-accent-violet/30"
            />
            <div className="min-w-0">
              <p className="text-xs text-[#f5b942]">{"★".repeat(t.rating)}</p>
              <blockquote className="mt-1 line-clamp-3 text-xs leading-relaxed text-foreground-muted">
                {t.quote}
              </blockquote>
              <figcaption className="mt-1.5 text-xs font-semibold text-foreground">
                {t.name}
              </figcaption>
            </div>
          </figure>
        ))}
      </div>

      <div className="relative mt-7 flex flex-col items-center gap-2">
        <Button href="/checkout" className="w-full sm:w-auto sm:px-10">
          Passer au Pro · {price} €/mois
        </Button>
        <p className="text-[11px] text-foreground-muted">
          Paiement sécurisé via Stripe · Résiliation en un clic, à tout moment
        </p>
      </div>
    </section>
  );
}
