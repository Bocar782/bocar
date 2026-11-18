import Link from "next/link";
import { BackgroundGlow } from "@/components/background-glow";
import { SiteHeader } from "@/components/site-header";
import { AudienceBenefits } from "@/components/marketing/audience-benefits";
import { Benefits } from "@/components/marketing/benefits";
import { ComparisonTable } from "@/components/marketing/comparison-table";
import { Faq } from "@/components/marketing/faq";
import { FAQ_ITEMS } from "@/components/marketing/faq-data";
import { InterfaceShowcase } from "@/components/marketing/interface-showcase";
import { MagneticButton } from "@/components/marketing/magnetic-button";
import { PricingSection } from "@/components/marketing/pricing-section";
import { Reveal } from "@/components/marketing/reveal";
import { TopicExamples } from "@/components/marketing/topic-examples";
import { WowDemo } from "@/components/marketing/wow-demo";
import { getSiteUrl } from "@/lib/site-url";

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

const FAQ_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_ITEMS.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: { "@type": "Answer", text: item.answer },
  })),
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
      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-violet-light">
        {eyebrow}
      </span>
      <h2 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
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

export default function Home() {
  return (
    <div className="relative flex-1 overflow-x-clip">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(SOFTWARE_APPLICATION_JSON_LD) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSON_LD) }}
      />
      <BackgroundGlow />
      <SiteHeader />

      {/* Hero */}
      <main className="relative z-10 mx-auto flex max-w-6xl flex-col items-center px-6 pb-32 pt-16 sm:pt-20">
        <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-border-subtle bg-white/[0.03] px-4 py-1.5 text-xs text-foreground-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-accent-violet" />
          Propulsé par l&apos;IA — pas un chatbot, une vraie formation
        </span>

        <h1 className="max-w-3xl text-balance text-center text-4xl font-semibold leading-[1.1] tracking-tight sm:text-6xl">
          Transforme n&apos;importe quel sujet en{" "}
          <span className="text-gradient">une formation interactive, claire et personnalisée</span>
        </h1>

        <p className="mt-6 max-w-xl text-balance text-center text-lg text-foreground-muted">
          Décris ce que tu veux apprendre. Tavyra génère une formation complète
          et structurée — chapitres progressifs, exemples concrets, exercices
          pratiques et quiz — adaptée à ton niveau, en quelques minutes.
        </p>

        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
          <MagneticButton
            href="/signup"
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-accent-blue to-accent-violet px-7 py-3.5 text-sm font-semibold text-white shadow-[0_8px_30px_-8px_var(--accent-violet)] transition-all hover:brightness-110"
          >
            Créer ma première formation →
          </MagneticButton>
          <a
            href="#comment-ca-marche"
            className="inline-flex items-center gap-2 rounded-full border border-border-subtle bg-white/5 px-7 py-3.5 text-sm font-medium text-foreground backdrop-blur transition-colors hover:bg-white/10"
          >
            Découvrir comment ça fonctionne
          </a>
        </div>

        <p className="mt-8 text-xs text-foreground-muted">
          <span className="font-semibold text-foreground">Gratuit, sans carte bancaire</span>{" "}
          pour ta première formation complète
        </p>

        {/* Démonstration visuelle */}
        <div className="mt-20 w-full sm:mt-28">
          <Reveal>
            <WowDemo />
          </Reveal>
        </div>

        {/* Comment ça marche */}
        <section id="comment-ca-marche" className="mt-32 w-full scroll-mt-20 sm:mt-40">
          <Reveal>
            <SectionHeading
              eyebrow="Comment ça marche"
              title="Trois étapes, zéro prompt à maîtriser"
              description="Pas besoin de savoir formuler une demande parfaite : décris simplement ton besoin."
            />
          </Reveal>
          <div className="mt-12 grid w-full grid-cols-1 gap-8 sm:grid-cols-3">
            {[
              {
                number: "01",
                title: "Décris ce que tu veux apprendre",
                description:
                  "Un mot, une phrase, une envie floue : pas besoin de savoir formuler un prompt parfait.",
              },
              {
                number: "02",
                title: "Tavyra structure ta formation",
                description:
                  "Objectifs, chapitres, exemples concrets et cas pratiques, adaptés à ton niveau et à ton sujet.",
              },
              {
                number: "03",
                title: "Apprends, teste, progresse",
                description:
                  "Avance à ton rythme, pose tes questions à Tavyra et valide tes acquis avec un quiz final.",
              },
            ].map((step, i) => (
              <Reveal key={step.number} delay={i * 100}>
                <div className="h-full rounded-2xl border border-border-subtle bg-white/[0.02] p-6">
                  <span className="text-sm font-mono text-accent-violet-light">
                    {step.number}
                  </span>
                  <h3 className="mt-3 text-base font-semibold text-foreground">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-foreground-muted">
                    {step.description}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Exemples de sujets */}
        <section className="mt-32 w-full sm:mt-40">
          <Reveal>
            <SectionHeading
              eyebrow="Un sujet, n'importe lequel"
              title="Business, sciences, histoire, examens..."
              description="Tavyra adapte la structure de la formation au domaine — voici quelques exemples parmi une infinité de sujets possibles."
            />
          </Reveal>
          <div className="mt-12">
            <Reveal>
              <TopicExamples />
            </Reveal>
          </div>
        </section>

        {/* Avantages */}
        <section id="avantages" className="relative mt-32 w-full scroll-mt-20 sm:mt-40">
          <div aria-hidden className="section-tint-violet" />
          <Reveal>
            <SectionHeading
              eyebrow="Pourquoi Tavyra"
              title="Une vraie pédagogie, pas une réponse générée à la va-vite"
            />
          </Reveal>
          <div className="mt-12">
            <Reveal>
              <Benefits />
            </Reveal>
          </div>
        </section>

        {/* Pour qui */}
        <section className="mt-32 w-full sm:mt-40">
          <Reveal>
            <SectionHeading
              eyebrow="Pour qui"
              title="Que tu apprennes pour toi ou pour ton business"
              description="Tavyra s'adapte à ton objectif, pas l'inverse."
            />
          </Reveal>
          <div className="mt-12">
            <Reveal>
              <AudienceBenefits />
            </Reveal>
          </div>
        </section>

        {/* Comparatif */}
        <section className="mt-32 w-full sm:mt-40">
          <Reveal>
            <SectionHeading
              eyebrow="La différence"
              title="Tavyra n'est pas un chatbot, ni un cours en ligne de plus"
            />
          </Reveal>
          <div className="mt-12">
            <Reveal>
              <ComparisonTable />
            </Reveal>
          </div>
        </section>

        {/* Présentation de l'interface */}
        <section className="relative mt-32 w-full sm:mt-40">
          <div aria-hidden className="section-tint-blue" />
          <Reveal>
            <SectionHeading
              eyebrow="À l'intérieur de Tavyra"
              title="Un tableau de bord pensé pour apprendre, pas pour discuter"
            />
          </Reveal>
          <div className="mt-12">
            <Reveal>
              <InterfaceShowcase />
            </Reveal>
          </div>
        </section>

        {/* Tarifs */}
        <section id="tarifs" className="relative mt-32 w-full scroll-mt-20 sm:mt-40">
          <div aria-hidden className="section-tint-violet" />
          <Reveal>
            <SectionHeading
              eyebrow="Tarifs"
              title="Des tarifs simples"
              description="Commence gratuitement, débloque la suite quand tu es prêt à aller plus loin."
            />
          </Reveal>
          <div className="mt-12">
            <Reveal>
              <PricingSection />
            </Reveal>
          </div>
        </section>

        {/* FAQ */}
        <section className="mt-32 w-full sm:mt-40">
          <Reveal>
            <SectionHeading eyebrow="FAQ" title="Questions fréquentes" />
          </Reveal>
          <div className="mt-12">
            <Reveal>
              <Faq />
            </Reveal>
          </div>
        </section>

        {/* CTA final */}
        <section className="mt-32 w-full sm:mt-40">
          <Reveal>
            <div className="relative overflow-hidden rounded-[32px] border border-border-subtle bg-background-elevated/80 px-6 py-16 text-center sm:px-16">
              <div
                aria-hidden
                className="absolute inset-0 bg-gradient-to-br from-accent-blue/15 via-transparent to-accent-violet/15"
              />
              <div className="relative">
                <h2 className="text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                  Prêt à apprendre autrement ?
                </h2>
                <p className="mx-auto mt-4 max-w-md text-balance text-foreground-muted">
                  Ta première formation est gratuite. Décris ton sujet, Tavyra
                  s&apos;occupe du reste.
                </p>
                <MagneticButton
                  href="/signup"
                  className="mt-8 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-accent-blue to-accent-violet px-7 py-3.5 text-sm font-semibold text-white shadow-[0_8px_30px_-8px_var(--accent-violet)] transition-all hover:brightness-110"
                >
                  Créer ma première formation →
                </MagneticButton>
              </div>
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
    </div>
  );
}
