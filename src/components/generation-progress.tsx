import { STAGE_LABELS, type GenerationStage } from "@/lib/courses/schemas";
import { Card } from "./ui/card";

// Doit refléter EXACTEMENT les valeurs réelles de GenerationStage
// (src/lib/courses/schemas.ts) — avant ce correctif, "finition",
// "quizFinal" et "assemblage" (ajoutées au Prompt 05.20.1) en étaient
// absentes : currentIndex valait -1 pendant ces étapes réelles et
// l'indicateur n'affichait plus aucune étape comme active/terminée,
// une progression affichée FAUSSE par rapport à l'état réel.
const STAGE_ORDER: GenerationStage[] = [
  "analyse",
  "recherche",
  "programme",
  "chapitres",
  "finition",
  "quizFinal",
  "assemblage",
  "pret",
];

export function GenerationProgress<Stage extends string>({
  currentStage,
  stageOrder = STAGE_ORDER as unknown as Stage[],
  stageLabels = STAGE_LABELS as unknown as Record<Stage, string>,
}: {
  currentStage: Stage;
  stageOrder?: Stage[];
  stageLabels?: Record<Stage, string>;
}) {
  const currentIndex = Math.max(0, stageOrder.indexOf(currentStage));
  const percent = Math.round(((currentIndex + 1) / stageOrder.length) * 100);

  return (
    <Card variant="panel" padding="md" className="mx-auto w-full max-w-md">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-foreground">Génération en cours</p>
        <span className="text-xs font-medium text-foreground-muted">{percent}%</span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-accent-blue to-accent-violet transition-[width] duration-500 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>

      <div className="relative mt-6 space-y-5">
        {/* Ligne de connexion verticale derrière les puces, pour lire la
            séquence comme une vraie chronologie plutôt que des points
            isolés — purement visuel, aucun changement de logique. */}
        <div
          aria-hidden
          className="absolute left-[13px] top-1 bottom-1 w-px bg-gradient-to-b from-border-subtle via-border-subtle to-transparent"
        />
        {stageOrder.map((stage, i) => {
          const isDone = i < currentIndex;
          const isActive = i === currentIndex;

          return (
            <div key={stage} className="relative flex items-center gap-3">
              <span
                className={
                  isDone
                    ? "relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent-blue to-accent-violet text-xs font-semibold text-white"
                    : isActive
                      ? "relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-accent-violet-light bg-background-elevated text-xs font-semibold text-accent-violet-light shadow-[0_0_0_4px_rgba(139,92,246,0.12)]"
                      : "relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border-subtle bg-background-elevated text-xs text-foreground-muted/50"
                }
              >
                {isDone ? "✓" : i + 1}
              </span>
              <span
                className={
                  isActive
                    ? "text-sm font-medium text-foreground"
                    : isDone
                      ? "text-sm text-foreground-muted"
                      : "text-sm text-foreground-muted/40"
                }
              >
                {stageLabels[stage]}
              </span>
              {isActive && (
                <span className="ml-auto h-1.5 w-1.5 animate-pulse rounded-full bg-accent-violet-light" />
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
