import type { ReactNode } from "react";

/**
 * État vide partagé (Prompt 05.14, retravaillé 05.23) : même ton neutre
 * déjà utilisé pour les listes vides (ex. "Aucune formation pour
 * l'instant...", historique de quiz) — un titre optionnel, une
 * description, une action optionnelle (bouton/lien déjà présent au-dessus
 * dans la plupart des cas, donc souvent omise ici pour ne pas la
 * dupliquer). `icon` est optionnel et purement décoratif (jamais requis
 * par les appelants existants) : un repère visuel discret plutôt qu'un
 * simple bloc de texte centré.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className = "",
}: {
  icon?: ReactNode;
  title?: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-dashed border-border-subtle bg-white/[0.015] px-6 py-10 text-center ${className}`}
    >
      {icon && (
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-accent-blue/15 to-accent-violet/15 text-accent-violet-light">
          {icon}
        </span>
      )}
      {title && (
        <p className={`text-sm font-medium text-foreground ${icon ? "mt-4" : ""}`}>{title}</p>
      )}
      <p className={`text-sm text-foreground-muted ${title || icon ? "mt-2" : ""}`}>
        {description}
      </p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
