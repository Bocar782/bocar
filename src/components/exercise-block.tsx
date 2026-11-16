"use client";

import { useState } from "react";
import { MarkdownContent } from "./markdown-content";

/**
 * Exercice pratique facultatif d'une leçon (Prompt 05.11) : la correction
 * est masquée par défaut (révélation volontaire, pour laisser une vraie
 * chance de chercher avant de voir la réponse) — un simple état local,
 * jamais persisté (pas besoin : rouvrir la leçon la remasque, cohérent
 * avec un exercice qu'on peut retenter). Composant séparé de
 * `course-view.tsx` pour rester testable isolément, sans dépendre du
 * reste de l'arborescence d'une formation.
 */
export function ExerciseBlock({ exercise }: { exercise: { prompt: string; solution: string } }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="mt-4 rounded-xl border border-l-4 border-border-subtle border-l-accent-blue/50 bg-white/[0.03] p-4">
      <span className="text-xs font-semibold uppercase tracking-wide text-accent-blue-light">
        Exercice pratique
      </span>
      <div className="mt-2 text-sm leading-relaxed text-foreground">
        <MarkdownContent content={exercise.prompt} />
      </div>
      <button
        type="button"
        onClick={() => setRevealed((v) => !v)}
        aria-expanded={revealed}
        className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-foreground-muted transition-colors hover:border-white/20 hover:bg-white/[0.06] hover:text-foreground"
      >
        {revealed ? "Masquer la correction" : "Voir la correction"}
      </button>
      {revealed && (
        <div className="mt-3 rounded-lg border border-accent-violet/25 bg-accent-violet/[0.08] p-3 text-sm leading-relaxed text-foreground">
          <MarkdownContent content={exercise.solution} />
        </div>
      )}
    </div>
  );
}
