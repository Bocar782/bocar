import type { ReactNode } from "react";

export type CardVariant = "default" | "elevated" | "panel" | "accent-violet" | "accent-blue";
export type CardPadding = "sm" | "md";

const PADDING_CLASSES: Record<CardPadding, string> = {
  sm: "p-4 sm:p-5",
  md: "p-6 sm:p-8",
};

/**
 * Bloc de contenu partagé (Prompt 05.14) : regroupe les quelques styles de
 * carte déjà répétés tels quels dans toute l'app, rien de nouveau.
 * - default : carte neutre (`rounded-2xl border-subtle bg-overlay/[0.02]`),
 *   la plus utilisée (listes, grilles, panneaux).
 * - elevated : grand panneau à bordure dégradée (quiz, résumé, historique) —
 *   même motif à 3 calques partout (bordure dégradée + fond élevé).
 * - panel : grand panneau à bordure simple sur fond élevé (ex. carte
 *   d'authentification, états "quota atteint"/"réservé au plan Pro") —
 *   même rayon que `elevated` mais sans bordure dégradée.
 * - accent-violet / accent-blue : encadré mis en avant avec une teinte
 *   d'accent (ex. "à retenir", meilleur score, exercice) — mêmes classes
 *   que celles déjà utilisées à la main à plusieurs endroits.
 */
export function Card({
  variant = "default",
  padding = "md",
  className = "",
  children,
}: {
  variant?: CardVariant;
  padding?: CardPadding;
  className?: string;
  children: ReactNode;
}) {
  if (variant === "elevated") {
    return (
      <div className={`relative rounded-[28px] p-px ${className}`}>
        <div
          aria-hidden
          className="absolute inset-0 rounded-[28px] bg-gradient-to-br from-accent-blue/40 via-overlay/10 to-accent-violet/40"
        />
        <div className={`relative rounded-[28px] bg-background-elevated/90 ${PADDING_CLASSES[padding]}`}>
          {children}
        </div>
      </div>
    );
  }

  if (variant === "panel") {
    return (
      <div
        className={`rounded-[28px] border border-border-subtle bg-background-elevated/80 ${PADDING_CLASSES[padding]} ${className}`}
      >
        {children}
      </div>
    );
  }

  if (variant === "accent-violet") {
    return (
      <div
        className={`rounded-xl border border-accent-violet/25 bg-accent-violet/[0.08] p-4 ${className}`}
      >
        {children}
      </div>
    );
  }

  if (variant === "accent-blue") {
    return (
      <div
        className={`rounded-xl border border-l-4 border-border-subtle border-l-accent-blue/50 bg-overlay/[0.03] p-4 ${className}`}
      >
        {children}
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border border-border-subtle bg-overlay/[0.02] ${PADDING_CLASSES[padding]} ${className}`}>
      {children}
    </div>
  );
}
