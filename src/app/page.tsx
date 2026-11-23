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
import { WowDemo } from "@/components/marketing/wow-demo";
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
      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-violet">
        {eyebrow}
      </span>
      <h2 className="mt-3 text-balance font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        {title}
      </h2>
      {description && (
        <p className="mt-4 text-balance text-base leading-relaxed text-foreground-muted">
          {description}
        </p>
      )}
    </div>
  );
}

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
    <div className="theme-landing-light relative flex-1 overflow-x-clip bg-background text-foreground">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(SOFTWARE_APPLICATION_JSON_LD) }}
      />
      <BackgroundGlow variant="light" />
      <SiteHeader variant="light" />

      <main className="relative z-10 w-full pb-32 pt-16 sm:pt-20">
        {/* Hero — composition éditoriale asymétrique 55/45, pas de centrage */}
        <section className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 px-6 lg:grid-cols-[1.15fr_1fr] lg:gap-10">
          <div aria-hidden className="hero-glow-light" />

          <div className="relative z-10">
            <span className="inline-flex items-center gap-2 rounded-full border border-border-subtle bg-background-card px-4 py-1.5 text-xs text-foreground-muted shadow-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-accent-violet" />
              Propulsé par l&apos;IA — pas un chatbot, une vraie formation
            </span>

            <h1 className="mt-7 max-w-xl text-balance font-display text-[2.5rem] font-semibold leading-[1.08] tracking-tight text-foreground sm:text-5xl lg:text-[3.25rem]">
              Transforme n&apos;importe quel sujet en{" "}
              <span className="text-accent-violet">
                une formation interactive, claire et personnalisée
              </span>
            </h1>

            <p className="mt-6 max-w-lg text-balance text-lg leading-relaxed text-foreground-muted">
              Décris ce que tu veux apprendre. Tavyra construit une vraie formation structurée
              — chapitres progressifs, exemples concrets, exercices et quiz — en quelques minutes.
            </p>

            <p className="mt-3 max-w-md text-sm text-foreground-muted/80">
              Pensé pour les <span className="font-medium text-foreground">entrepreneurs</span> qui
              veulent comprendre vite, et les{" "}
              <span className="font-medium text-foreground">étudiants</span> qui veulent vraiment
              maîtriser leur sujet.
            </p>

            <div className="mt-9 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <MagneticButton
                href="/signup"
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#8b5cf6] to-accent-violet px-7 py-3.5 text-base font-semibold text-white shadow-[0_12px_32px_-10px_rgba(147,51,234,0.55)] transition-all hover:brightness-110"
              >
                Créer ma première formation →
              </MagneticButton>
              <a
                href="#fonctionnalites"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground-muted transition-colors hover:text-foreground"
              >
                Découvrir les fonctionnalités →
              </a>
            </div>

            <TrustStrip className="mt-7" />
          </div>

          <div className="relative z-10">
            <HeroShowcase />
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
        <section className="relative mt-24 w-full bg-background-elevated py-16 sm:mt-28 sm:py-20">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mx-auto max-w-4xl">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-violet">
                En direct
              </span>
              <p className="mt-2 max-w-md text-balance font-display text-xl font-semibold text-foreground sm:text-2xl">
                Regarde Tavyra construire une formation, avec ton propre sujet
              </p>
            </div>
            <div className="mt-8">
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
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-violet">
              Fonctionnalités
            </span>
            <h2 className="mt-3 text-balance font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Une vraie pédagogie, pas une réponse générée à la va-vite
            </h2>
          </div>
          <div className="mt-12">
            <Reveal>
              <FeatureBand />
            </Reveal>
          </div>
        </section>

        {/* Pour qui — bande teintée */}
        <section className="relative mt-24 w-full bg-background-elevated py-16 sm:mt-28 sm:py-20">
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
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-violet">
              Pourquoi nous
            </span>
            <h2 className="mt-3 text-balance font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Pourquoi nous existons
            </h2>
            <p className="mt-4 text-balance text-base leading-relaxed text-foreground-muted">
              Tavyra n&apos;est pas né d&apos;une envie de faire « encore un outil IA ». Il est né
              d&apos;un constat simple : apprendre un nouveau sujet aujourd&apos;hui est
              inutilement difficile — pas par manque d&apos;information, mais par excès.
            </p>
            <Link
              href="/pourquoi-nous"
              className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-accent-violet-light transition-colors hover:text-foreground"
            >
              En savoir plus →
            </Link>
          </div>
        </section>

        {/* Avis — Prompt 06.11, vrais avis d'utilisateurs (texte + photo
            fournis directement, jamais inventés — voir Prompt 05.22 qui
            avait retiré les précédents témoignages fictifs). */}
        <section className="relative mt-24 w-full bg-background-elevated py-16 sm:mt-28 sm:py-20">
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
        <section className="relative mt-24 w-full bg-background-elevated py-16 sm:mt-28 sm:py-20">
          <div className="mx-auto max-w-6xl px-6">
            <SectionHeading eyebrow="FAQ" title="Questions fréquentes" />
            <div className="mt-10">
              <Reveal>
                <Faq items={SHORT_FAQ_ITEMS} />
              </Reveal>
            </div>
          </div>
        </section>

        {/* CTA final — Prompt 05.33, épuré : pas de cadre/carte, juste une
            courte phrase et le bouton, directement sur le fond de la page */}
        <section className="relative mx-auto mt-24 max-w-6xl px-6 pb-8 text-center sm:mt-28">
          <Reveal>
            <p className="font-display text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              Prêt à apprendre autrement ?
            </p>
            <div className="mt-7 flex justify-center">
              <MagneticButton
                href="/signup"
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#8b5cf6] to-accent-violet px-7 py-3.5 text-sm font-semibold text-white shadow-[0_12px_32px_-10px_rgba(147,51,234,0.55)] transition-all hover:brightness-110"
              >
                Créer ma première formation →
              </MagneticButton>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="relative z-10 border-t border-border-subtle">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-xs text-foreground-muted sm:flex-row">
          <span>© {new Date().getFullYear()} Tavyra. Tous droits réservés.</span>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
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
