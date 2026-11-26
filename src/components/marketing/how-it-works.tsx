import { IconChat, IconGraduationCap, IconTarget } from "./icons";

// Reprend exactement le déroulé réel affiché dans /dashboard/creer
// (diagnostic → plan → formation générée) — jamais une description
// différente de ce que le produit fait vraiment.
const STEPS = [
  {
    icon: IconChat,
    title: "Diagnostic guidé",
    description: "Quelques questions adaptées à ton sujet pour cerner ton niveau réel.",
  },
  {
    icon: IconTarget,
    title: "Plan proposé",
    description: "Un programme de modules et de chapitres que tu peux ajuster avant de valider.",
  },
  {
    icon: IconGraduationCap,
    title: "Formation générée",
    description: "Chapitres, exemples, exercices et quiz prêts à être lus dans la foulée.",
  },
] as const;

export function HowItWorks() {
  return (
    <ol className="relative grid grid-cols-1 gap-5 sm:grid-cols-3">
      <div
        aria-hidden
        className="absolute left-[16%] right-[16%] top-[3.25rem] hidden h-px bg-gradient-to-r from-transparent via-accent-violet/50 to-transparent sm:block"
      />
      {STEPS.map((step, i) => {
        const Icon = step.icon;
        return (
          <li
            key={step.title}
            className="glass-card lift relative rounded-2xl p-6 text-center sm:p-7"
          >
            <div className="relative mx-auto flex h-14 w-14 items-center justify-center">
              <span
                aria-hidden
                className="absolute inset-0 rounded-2xl bg-accent-violet/30 blur-xl"
              />
              <span className="bg-brand relative flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]">
                <Icon width={24} height={24} />
              </span>
              <span className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-border-subtle bg-background-card text-[11px] font-bold text-accent-violet-light">
                {i + 1}
              </span>
            </div>
            <p className="mt-5 text-base font-semibold text-foreground">{step.title}</p>
            <p className="mt-2 text-sm leading-relaxed text-foreground-muted">{step.description}</p>
          </li>
        );
      })}
    </ol>
  );
}
