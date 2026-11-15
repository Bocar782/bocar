import { STAGE_LABELS, type GenerationStage } from "@/lib/courses/schemas";

const STAGE_ORDER: GenerationStage[] = [
  "analyse",
  "recherche",
  "programme",
  "chapitres",
  "pret",
];

export function GenerationProgress({
  currentStage,
}: {
  currentStage: GenerationStage;
}) {
  const currentIndex = STAGE_ORDER.indexOf(currentStage);

  return (
    <div className="mx-auto w-full max-w-md space-y-4">
      {STAGE_ORDER.map((stage, i) => {
        const isDone = i < currentIndex;
        const isActive = i === currentIndex;

        return (
          <div key={stage} className="flex items-center gap-3">
            <span
              className={
                isDone
                  ? "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent-blue to-accent-violet text-xs font-semibold text-white"
                  : isActive
                    ? "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-accent-violet-light text-xs font-semibold text-accent-violet-light"
                    : "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border-subtle text-xs text-foreground-muted/50"
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
              {STAGE_LABELS[stage]}
            </span>
            {isActive && (
              <span className="ml-auto h-1.5 w-1.5 animate-pulse rounded-full bg-accent-violet-light" />
            )}
          </div>
        );
      })}
    </div>
  );
}
