import Link from "next/link";
import { BackgroundGlow } from "@/components/background-glow";
import { SiteHeader } from "@/components/site-header";
import { AudienceBenefits } from "@/components/marketing/audience-benefits";
import { Faq } from "@/components/marketing/faq";
import { SHORT_FAQ_ITEMS } from "@/components/marketing/faq-data";
import { FeatureBand } from "@/components/marketing/feature-band";
import { HeroShowcase } from "@/components/marketing/hero-showcase";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { MagneticButton } from "@/components/marketing/magnetic-button";
import { PricingCards } from "@/components/marketing/pricing-cards";
import { Reveal } from "@/components/marketing/reveal";
import { StickyMobileCta } from "@/components/marketing/sticky-mobile-cta";
import { Testimonials } from "@/components/marketing/testimonials";
import { TrustStrip } from "@/components/marketing/trust-strip";
import { TopicMarquee } from "@/components/marketing/topic-marquee";
import { WowDemo } from "@/components/marketing/wow-demo";
import { BrandMark } from "@/components/brand-mark";
import { isOnFreePlan } from "@/lib/courses/plan";
import { getSiteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

const SOFTWARE_APPLICATION_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Tavyra",
  url: getSiteUrl(),
  applicationCategory: "EducationalApplication",
  operatingSystem: "Web",
  description:
    "Tavyra est une plateforme d'apprentissage assistée par IA : décris ce que tu veux apprendre, elle génère une formation complète, structurée et personnalisée.",
  offers: [
    { "@type": "Offer", name: "Gratuit", price: "0", priceCurrency: "EUR" },
    { "@type": "Offer", name: "Pro", price: "9.99", priceCurrency: "EUR" },
  ],
};

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <span className="inline-flex items-center gap-2 rounded-full border border-accent-violet/30 bg-accent-violet/10 px-3.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-violet-light">
        <span className="bg-brand h-1.5 w-1.5 rounded-full" />
        {eyebrow}
      </span>
      <h2 className="mt-5 text-balance font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        {title}
      </h2>
      {description && (
        <p className="mt-4 text-balance text-base leading-relaxed text-foreground-muted sm:text-lg">
          {description}
        </p>
      )}
    </div>
  );
}

const PRIMARY_CTA =
  "btn-brand inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-base font-semibold text-white";

export default async function Home() {
  // Prompt 05.31 : la landing affiche désormais une section Tarifs réelle
  // (auth-aware, via PricingCards partagé avec /pricing) — nécessite de
  // savoir si un visiteur est connecté et son statut d'abonnement, comme
  // /pricing/page.tsx.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const onFreePlan = user ? await isOnFreePlan(supabase, user.id) : true;

  return (
    <div className="theme-landing-light relative isolate flex-1 overflow-x-clip bg-background text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(SOFTWARE_APPLICATION_JSON_LD) }}
      />
      <BackgroundGlow variant="light" />
      <SiteHeader variant="light" />

      <main className="relative z-10 w-full pb-32 pt-16 sm:pt-20">
        {/* Hero */}
        <section className="relative">
          <div aria-hidden className="hero-grid -top-20" />
          <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 px-6 lg:grid-cols-[1.1fr_1fr] lg:gap-12">
            <div className="relative z-10">
              <span
                className="rise inline-flex items-center gap-2.5 rounded-full border border-accent-violet/30 bg-accent-violet/10 px-4 py-1.5 text-xs font-medium text-accent-violet-light backdrop-blur"
                style={{ ["--d" as string]: "0ms" }}
              >
                <span className="pulse-dot h-2 w-2 rounded-full bg-accent-violet-light" />
                Propulsé par l&apos;IA — pas un chatbot, une vraie formation
              </span>

              <h1
                className="rise mt-7 max-w-xl text-balance font-display text-[2.5rem] font-semibold leading-[1.06] tracking-tight text-foreground sm:text-[3.2rem] lg:text-[3.35rem]"
                style={{ ["--d" as string]: "100ms" }}
              >
                Transforme n&apos;importe quel sujet en{" "}
                <span className="text-shimmer">une formation interactive, claire et personnalisée</span>
              </h1>

              <p
                className="rise mt-6 max-w-lg text-balance text-lg leading-relaxed text-foreground-muted"
                style={{ ["--d" as string]: "200ms" }}
              >
                Décris ce que tu veux apprendre. Tavyra construit une vraie formation structurée
                — chapitres progressifs, exemples concrets, exercices et quiz — en quelques minutes.
              </p>

              <p
                className="rise mt-3 max-w-md text-sm text-foreground-muted/90"
                style={{ ["--d" as string]: "260ms" }}
              >
                Pensé pour les <span className="font-medium text-foreground">entrepreneurs</span> qui
                veulent comprendre vite, et les{" "}
                <span className="font-medium text-foreground">étudiants</span> qui veulent vraiment
                maîtriser leur sujet.
              </p>

              <div
                className="rise mt-9 flex flex-col items-start gap-4 sm:flex-row sm:items-center"
                style={{ ["--d" as string]: "340ms" }}
              >
                <MagneticButton href="/signup" className={PRIMARY_CTA}>
                  Créer ma première formation →
                </MagneticButton>
                <a
                  href="#fonctionnalites"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border-subtle bg-white/[0.04] px-5 py-3.5 text-sm font-medium text-foreground backdrop-blur transition-colors hover:border-accent-violet/40 hover:bg-white/[0.07]"
                >
                  Découvrir les fonctionnalités
                </a>
              </div>

              <div className="rise" style={{ ["--d" as string]: "420ms" }}>
                <TrustStrip className="mt-8" />
              </div>
            </div>

            <div className="rise relative z-10" style={{ ["--d" as string]: "250ms" }}>
              <HeroShowcase />
            </div>
          </div>

          <div className="relative mx-auto mt-16 max-w-6xl px-6 sm:mt-20">
            <p className="mb-4 text-center text-xs font-medium uppercase tracking-[0.2em] text-foreground-muted/80">
              Apprends vraiment n&apos;importe quel sujet
            </p>
            <TopicMarquee />
          </div>
        </section>

        {/* Comment ça marche — Prompt 06.13, reprend le déroulé réel
            (diagnostic → plan → formation) avant la démo, pour que le
            visiteur sache à quoi s'attendre avant de la voir à l'œuvre. */}
        <section className="relative mx-auto mt-24 max-w-6xl px-6 sm:mt-28">
          <SectionHeading
            eyebrow="Comment ça marche"
            title="Trois étapes, pas plus"
            description="Pas de prompt à deviner : un déroulé guidé, du sujet à la formation finie."
          />
          <div className="mt-12">
            <Reveal>
              <HowItWorks />
            </Reveal>
          </div>
        </section>

        {/* Démonstration interactive — bande teintée (Prompt 05.28, rupture
            visuelle entre les sections) ; intégrée à la suite du hero, pas
            un bloc isolé avec légende flottante */}
        <section className="relative mt-24 w-full py-16 sm:mt-28 sm:py-20">
          <div aria-hidden className="glow-divider absolute inset-x-0 top-0" />
          <div aria-hidden className="absolute inset-0 -z-10 bg-white/[0.015]" />
          <div className="mx-auto max-w-6xl px-6">
            <SectionHeading
              eyebrow="En direct"
              title="Regarde Tavyra construire une formation"
              description="Avec ton propre sujet : tape-le, et suis les vraies étapes de génération."
            />
            <div className="mt-12">
              <Reveal>
                <WowDemo />
              </Reveal>
            </div>
          </div>
        </section>

        {/* Fonctionnalités — bandeau à filets, pas de cartes répétées */}
        <section
          id="fonctionnalites"
          className="relative mx-auto mt-24 max-w-6xl scroll-mt-20 px-6 sm:mt-28"
        >
          <SectionHeading
            eyebrow="Fonctionnalités"
            title="Une vraie pédagogie, pas une réponse générée à la va-vite"
          />
          <div className="mt-12">
            <Reveal>
              <FeatureBand />
            </Reveal>
          </div>
        </section>

        {/* Pour qui — bande teintée */}
        <section className="relative mt-24 w-full py-16 sm:mt-28 sm:py-20">
          <div aria-hidden className="glow-divider absolute inset-x-0 top-0" />
          <div aria-hidden className="absolute inset-0 -z-10 bg-white/[0.015]" />
          <div aria-hidden className="glow-divider absolute inset-x-0 bottom-0" />
          <div className="mx-auto max-w-6xl px-6">
            <SectionHeading
              eyebrow="Pour qui"
              title="Une solution pensée pour tous"
              description="Que tu apprennes pour toi ou pour ton business, Tavyra s'adapte à ton objectif."
            />
            <div className="mt-12">
              <Reveal>
                <AudienceBenefits />
              </Reveal>
            </div>
          </div>
        </section>

        {/* Pourquoi nous — Prompt 05.31, résumé réel (même texte que
            /pourquoi-nous) avec lien vers la page complète, pas une
            duplication intégrale. */}
        <section className="relative mx-auto mt-24 max-w-6xl px-6 sm:mt-28">
          <div className="glass-card gradient-border relative mx-auto max-w-3xl overflow-hidden rounded-3xl px-6 py-12 text-center sm:px-12">
            <div
              aria-hidden
              className="absolute -top-24 left-1/2 h-48 w-96 -translate-x-1/2 rounded-full bg-accent-violet/25 blur-3xl"
            />
            <span className="relative inline-flex items-center gap-2 rounded-full border border-accent-violet/30 bg-accent-violet/10 px-3.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-violet-light">
              <span className="bg-brand h-1.5 w-1.5 rounded-full" />
              Pourquoi nous
            </span>
            <h2 className="relative mt-5 text-balance font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Pourquoi nous existons
            </h2>
            <p className="relative mt-5 text-balance text-base leading-relaxed text-foreground-muted sm:text-lg">
              Tavyra n&apos;est pas né d&apos;une envie de faire « encore un outil IA ». Il est né
              d&apos;un constat simple : apprendre un nouveau sujet aujourd&apos;hui est
              inutilement difficile — pas par manque d&apos;information, mais par excès.
            </p>
            <Link
              href="/pourquoi-nous"
              className="relative mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-accent-violet-light transition-colors hover:text-foreground"
            >
              En savoir plus →
            </Link>
          </div>
        </section>

        {/* Avis — Prompt 06.11, vrais avis d'utilisateurs (texte + photo
            fournis directement, jamais inventés — voir Prompt 05.22 qui
            avait retiré les précédents témoignages fictifs). */}
        <section className="relative mt-24 w-full py-16 sm:mt-28 sm:py-20">
          <div aria-hidden className="glow-divider absolute inset-x-0 top-0" />
          <div aria-hidden className="absolute inset-0 -z-10 bg-white/[0.015]" />
          <div aria-hidden className="glow-divider absolute inset-x-0 bottom-0" />
          <div className="mx-auto max-w-6xl px-6">
            <SectionHeading
              eyebrow="Avis"
              title="Ce qu'ils en disent"
              description="Des retours réels d'utilisateurs de Tavyra, dans des contextes très différents."
            />
            <div className="mt-12">
              <Reveal>
                <Testimonials />
              </Reveal>
            </div>
          </div>
        </section>

        {/* Tarifs — Prompt 05.31, mêmes offres que /pricing (PricingCards
            partagé, jamais de divergence) */}
        <section id="tarifs" className="relative mx-auto mt-24 max-w-6xl scroll-mt-20 px-6 sm:mt-28">
          <SectionHeading
            eyebrow="Tarifs"
            title="Des tarifs simples"
            description="Commence gratuitement, débloque la suite quand tu es prêt à aller plus loin."
          />
          <div className="mt-12">
            <Reveal>
              <PricingCards user={user} onFreePlan={onFreePlan} />
            </Reveal>
          </div>
          <TrustStrip className="mt-10 justify-center" />
        </section>

        {/* FAQ — Prompt 05.31, bande teintée, sous-ensemble court partagé
            avec /pricing */}
        <section className="relative mt-24 w-full py-16 sm:mt-28 sm:py-20">
          <div aria-hidden className="glow-divider absolute inset-x-0 top-0" />
          <div aria-hidden className="absolute inset-0 -z-10 bg-white/[0.015]" />
          <div aria-hidden className="glow-divider absolute inset-x-0 bottom-0" />
          <div className="mx-auto max-w-6xl px-6">
            <SectionHeading eyebrow="FAQ" title="Questions fréquentes" />
            <div className="mt-10">
              <Reveal>
                <Faq items={SHORT_FAQ_ITEMS} />
              </Reveal>
            </div>
          </div>
        </section>

        {/* CTA final */}
        <section className="relative mx-auto mt-24 max-w-6xl px-6 sm:mt-28">
          <Reveal>
            <div className="relative overflow-hidden rounded-[32px] px-6 py-16 text-center sm:px-12 sm:py-20">
              <div aria-hidden className="bg-brand absolute inset-0" />
              <div
                aria-hidden
                className="absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_50%_0%,rgba(255,255,255,0.28),transparent_70%)]"
              />
              <div aria-hidden className="hero-grid opacity-60" />
              <div className="relative">
                <span className="float-y mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-[0_16px_40px_-12px_rgba(20,5,50,0.6)]">
                  <BrandMark size={44} />
                </span>
                <p className="mx-auto mt-6 max-w-xl text-balance font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  Prêt à apprendre autrement ?
                </p>
                <p className="mx-auto mt-4 max-w-md text-balance text-base text-white/80">
                  Commence gratuitement, sans carte bancaire.
                </p>
                <div className="mt-9 flex justify-center">
                  <MagneticButton
                    href="/signup"
                    className="inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-base font-semibold text-[#4c1d95] shadow-[0_16px_40px_-12px_rgba(20,5,50,0.6)] transition-transform hover:scale-[1.02]"
                  >
                    Créer ma première formation →
                  </MagneticButton>
                </div>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="relative z-10 mt-8">
        <div aria-hidden className="glow-divider" />
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-6 py-10 sm:flex-row">
          <div className="flex flex-col items-center gap-2 sm:items-start">
            <Link href="/" className="flex items-center gap-2">
              <BrandMark size={28} />
              <span className="text-base font-semibold tracking-tight text-foreground">Tavyra</span>
            </Link>
            <span className="text-xs text-foreground-muted">
              © {new Date().getFullYear()} Tavyra. Tous droits réservés.
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-foreground-muted">
            <Link href="/pricing" className="transition-colors hover:text-foreground">
              Tarifs
            </Link>
            <Link href="/pourquoi-nous" className="transition-colors hover:text-foreground">
              Pourquoi nous existons
            </Link>
            <Link href="/confidentialite" className="transition-colors hover:text-foreground">
              Confidentialité
            </Link>
            <Link href="/conditions-utilisation" className="transition-colors hover:text-foreground">
              Conditions d&apos;utilisation
            </Link>
          </div>
        </div>
      </footer>

      <StickyMobileCta />
    </div>
  );
}
