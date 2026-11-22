import Link from "next/link";
import { BackgroundGlow } from "@/components/background-glow";
import { SiteHeader } from "@/components/site-header";
import { AudienceBenefits } from "@/components/marketing/audience-benefits";
import { FeatureStrip } from "@/components/marketing/feature-strip";
import { MagneticButton } from "@/components/marketing/magnetic-button";
import { Reveal } from "@/components/marketing/reveal";
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
      <BackgroundGlow />
      <SiteHeader />

      {/* Hero */}
      <main className="relative z-10 mx-auto flex max-w-6xl flex-col items-center px-6 pb-32 pt-16 sm:pt-20">
        <span className="mb-7 inline-flex items-center gap-2 rounded-full border border-border-subtle bg-white/[0.03] px-4 py-1.5 text-xs text-foreground-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-accent-violet" />
          Propulsé par l&apos;IA — pas un chatbot, une vraie formation
        </span>

        <h1 className="max-w-4xl text-balance text-center text-[2.75rem] font-semibold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
          Transforme n&apos;importe quel sujet en{" "}
          <span className="text-gradient">une formation interactive, claire et personnalisée</span>
        </h1>

        <p className="mt-7 max-w-2xl text-balance text-center text-lg leading-relaxed text-foreground-muted sm:text-xl">
          Décris ce que tu veux apprendre. Tavyra construit une vraie formation structurée
          — chapitres progressifs, exemples concrets, exercices et quiz — en quelques minutes.
        </p>

        <p className="mt-3 max-w-xl text-balance text-center text-sm text-foreground-muted/80">
          Pensé pour les <span className="font-medium text-foreground">entrepreneurs</span> qui
          veulent comprendre vite, et les{" "}
          <span className="font-medium text-foreground">étudiants</span> qui veulent vraiment
          maîtriser leur sujet.
        </p>

        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
          <MagneticButton
            href="/signup"
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-accent-blue to-accent-violet px-8 py-4 text-base font-semibold text-white shadow-[0_8px_40px_-6px_var(--accent-violet)] transition-all hover:brightness-110"
          >
            Créer ma première formation →
          </MagneticButton>
          <a
            href="#fonctionnalites"
            className="inline-flex items-center gap-2 rounded-full border border-border-subtle px-7 py-4 text-sm font-medium text-foreground-muted transition-colors hover:border-white/20 hover:text-foreground"
          >
            Découvrir les fonctionnalités
          </a>
        </div>

        <p className="mt-8 text-xs text-foreground-muted">
          <span className="font-semibold text-foreground">Gratuit, sans carte bancaire</span>{" "}
          pour ta première formation complète
        </p>

        {/* Démonstration visuelle — intégrée directement à la suite du hero,
            sans bloc isolé : prolonge la même respiration visuelle plutôt
            qu'une section à part. */}
        <div className="mt-14 w-full sm:mt-16">
          <Reveal>
            <WowDemo />
          </Reveal>
        </div>

        {/* Fonctionnalités (bandeau condensé, remplace l'ancienne grille de
            6 cartes — direction premium : moins de blocs, plus de clarté) */}
        <section id="fonctionnalites" className="mt-24 w-full scroll-mt-20 sm:mt-28">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-violet-light">
              Fonctionnalités
            </span>
            <h2 className="mt-3 text-balance text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              Une vraie pédagogie, pas une réponse générée à la va-vite
            </h2>
          </div>
          <div className="mt-10">
            <Reveal>
              <FeatureStrip />
            </Reveal>
          </div>
        </section>

        {/* Pour qui — dernière section de la page, rien après. */}
        <section className="mt-24 w-full sm:mt-28">
          <SectionHeading
            eyebrow="Pour qui"
            title="Une solution pensée pour tous"
            description="Que tu apprennes pour toi ou pour ton business, Tavyra s'adapte à ton objectif."
          />
          <div className="mt-10">
            <Reveal>
              <AudienceBenefits />
            </Reveal>
          </div>
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
