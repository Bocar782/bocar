import type { ReactNode } from "react";

/**
 * État vide partagé (Prompt 05.14) : même ton neutre déjà utilisé pour les
 * listes vides (ex. "Aucune formation pour l'instant...", historique de
 * quiz) — un titre optionnel, une description, une action optionnelle
 * (bouton/lien déjà présent au-dessus dans la plupart des cas, donc souvent
 * omise ici pour ne pas la dupliquer).
 */
export function EmptyState({
  title,
  description,
  action,
  className = "",
}: {
  title?: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`text-center ${className}`}>
      {title && <p className="text-sm font-medium text-foreground">{title}</p>}
      <p className={`text-sm text-foreground-muted ${title ? "mt-2" : ""}`}>{description}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
