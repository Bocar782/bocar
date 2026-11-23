import type { ReactNode } from "react";

export type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger" | "accent";

// Teintes centralisées (Prompt 05.14) : reprennent exactement les classes
// déjà utilisées pour chaque statut à travers l'app (course-list-item,
// quiz-history, deep-analysis-list-item...) — jamais une nouvelle couleur.
const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-overlay/[0.06] text-foreground-muted",
  info: "bg-accent-blue/15 text-accent-blue-light",
  success: "bg-success/15 text-success-light",
  warning: "bg-warning/15 text-warning-light",
  danger: "bg-danger/15 text-danger-light",
  accent: "bg-accent-violet/15 text-accent-violet-light",
};

/** Petite pastille de statut/plan partagée (Prompt 05.14). */
export function Badge({
  tone = "neutral",
  className = "",
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-medium ${TONE_CLASSES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
