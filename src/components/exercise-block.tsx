"use client";

import { useState } from "react";
import { Card } from "./ui/card";
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
    <Card variant="accent-blue" className="mt-4">
      {/* Puce ✎ : même glyphe que l'entrée "Quiz du module" du sommaire
          (course-sidebar.tsx) — signale "à faire soi-même", distingue
          immédiatement ce bloc interactif des encadrés "Exemple concret" et
          "À retenir" qui partagent par ailleurs la même teinte bleue. */}
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-blue/15 text-sm text-accent-blue-light"
        >
          ✎
        </span>
        <span className="text-xs font-semibold uppercase tracking-wide text-accent-blue-light">
          Exercice pratique
        </span>
      </div>
      <div className="mt-2.5 text-sm leading-relaxed text-foreground">
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
          <span className="text-[11px] font-semibold uppercase tracking-wide text-accent-violet-light">
            Correction
          </span>
          <div className="mt-1.5">
            <MarkdownContent content={exercise.solution} />
          </div>
        </div>
      )}
    </Card>
  );
}
