import { IconChat, IconGraduationCap, IconTarget } from "./icons";

// Prompt 06.13 : reprend exactement le déroulé réel déjà affiché dans
// /dashboard/creer (diagnostic → plan → formation générée) pour donner au
// visiteur, avant même la démo, une attente juste de ce qui va se passer —
// jamais une description différente de ce que le produit fait vraiment.
const STEPS = [
  {
    icon: IconChat,
    title: "1. Diagnostic guidé",
    description: "Quelques questions adaptées à ton sujet pour cerner ton niveau réel.",
  },
  {
    icon: IconTarget,
    title: "2. Plan proposé",
    description: "Un programme de modules et de chapitres que tu peux ajuster avant de valider.",
  },
  {
    icon: IconGraduationCap,
    title: "3. Formation générée",
    description: "Chapitres, exemples, exercices et quiz prêts à être lus dans la foulée.",
  },
] as const;

export function HowItWorks() {
  return (
    <ol className="grid grid-cols-1 gap-5 sm:grid-cols-3">
      {STEPS.map((step) => {
        const Icon = step.icon;
        return (
          <li
            key={step.title}
            className="rounded-2xl border border-border-subtle bg-background-card p-6"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-violet-tint text-accent-violet">
              <Icon width={19} height={19} />
            </span>
            <p className="mt-4 text-sm font-semibold text-foreground">{step.title}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-foreground-muted">
              {step.description}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
