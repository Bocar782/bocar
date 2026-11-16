import type { ReactNode } from "react";

export type CalloutTone = "info" | "success" | "warning" | "error";

// Reprend exactement les classes déjà utilisées pour chaque encadré à
// travers l'app (AuthMessage, erreurs de génération, avertissement de
// sauvegarde...) — Prompt 05.14, aucune nouvelle couleur introduite.
const TONE_CLASSES: Record<CalloutTone, string> = {
  info: "border-accent-blue/20 bg-accent-blue/10 text-accent-blue-light",
  success: "border-success/20 bg-success/10 text-success-light",
  warning: "border-warning/20 bg-warning/10 text-warning-light",
  error: "border-danger/20 bg-danger/10 text-danger-light",
};

/** Encadré d'information/succès/avertissement/erreur partagé (Prompt 05.14). */
export function Callout({
  tone,
  className = "",
  children,
  role,
}: {
  tone: CalloutTone;
  className?: string;
  children: ReactNode;
  role?: "alert" | "status";
}) {
  return (
    <p
      role={role}
      className={`rounded-xl border px-4 py-2.5 text-sm leading-relaxed ${TONE_CLASSES[tone]} ${className}`}
    >
      {children}
    </p>
  );
}
