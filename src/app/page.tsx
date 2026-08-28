import { BackgroundGlow } from "@/components/background-glow";
import { GenerateForm } from "@/components/generate-form";
import { SiteHeader } from "@/components/site-header";

const STEPS = [
  {
    number: "01",
    title: "Décris ce que tu veux apprendre",
    description:
      "Un mot, une phrase, une envie floue : pas besoin de savoir formuler un prompt parfait.",
  },
  {
    number: "02",
    title: "Lia structure ta formation",
    description:
      "Objectifs, chapitres, exemples concrets et cas pratiques, adaptés à ton niveau et à ton sujet.",
  },
  {
    number: "03",
    title: "Apprends, teste, progresse",
    description:
      "Avance à ton rythme, pose tes questions à Lia et valide tes acquis avec un quiz final.",
  },
];

export default function Home() {
  return (
    <div className="relative flex-1">
      <BackgroundGlow />
      <SiteHeader />

      <main className="relative z-10 mx-auto flex max-w-6xl flex-col items-center px-6 pb-32 pt-16 sm:pt-24">
        <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-border-subtle bg-white/[0.03] px-4 py-1.5 text-xs text-foreground-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-accent-violet" />
          Propulsé par l&apos;IA — pas un chatbot, une vraie formation
        </span>

        <h1 className="max-w-3xl text-balance text-center text-4xl font-semibold leading-[1.1] tracking-tight sm:text-6xl">
          Transforme n&apos;importe quel sujet en{" "}
          <span className="text-gradient">formation sur mesure</span>
        </h1>

        <p className="mt-6 max-w-xl text-balance text-center text-lg text-foreground-muted">
          Écris ce que tu veux apprendre. Lia génère une formation complète,
          claire et structurée : chapitres, exemples, cas pratiques et quiz.
        </p>

        <div className="mt-12 w-full">
          <GenerateForm />
        </div>

        <section
          id="comment-ca-marche"
          className="mt-32 grid w-full grid-cols-1 gap-8 sm:grid-cols-3"
        >
          {STEPS.map((step) => (
            <div
              key={step.number}
              className="rounded-2xl border border-border-subtle bg-white/[0.02] p-6"
            >
              <span className="text-sm font-mono text-accent-violet-light">
                {step.number}
              </span>
              <h3 className="mt-3 text-base font-semibold text-foreground">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-foreground-muted">
                {step.description}
              </p>
            </div>
          ))}
        </section>
      </main>

      <footer className="relative z-10 border-t border-border-subtle">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-xs text-foreground-muted sm:flex-row">
          <span>© {new Date().getFullYear()} Lia. Tous droits réservés.</span>
          <div className="flex items-center gap-6">
            <a href="#" className="transition-colors hover:text-foreground">
              Confidentialité
            </a>
            <a href="#" className="transition-colors hover:text-foreground">
              Conditions d&apos;utilisation
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
