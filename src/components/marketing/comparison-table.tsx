type Cell = "yes" | "no" | "partial";

const ROWS: { label: string; lia: Cell; chatbot: Cell; course: Cell }[] = [
  { label: "Parcours structuré et progressif", lia: "yes", chatbot: "no", course: "yes" },
  { label: "Adapté à ton niveau et à ton sujet exact", lia: "yes", chatbot: "partial", course: "no" },
  { label: "Exemples réels, avec sources citées", lia: "yes", chatbot: "partial", course: "partial" },
  { label: "Quiz généré à partir du contenu réel", lia: "yes", chatbot: "no", course: "partial" },
  { label: "Répond à tes questions dans le contexte exact", lia: "yes", chatbot: "partial", course: "no" },
  { label: "Prêt en quelques minutes", lia: "yes", chatbot: "yes", course: "no" },
];

function CellMark({ value }: { value: Cell }) {
  if (value === "yes") {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-accent-violet/15 text-accent-violet-light">
        ✓
      </span>
    );
  }
  if (value === "partial") {
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/[0.06] text-foreground-muted">
        ±
      </span>
    );
  }
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/[0.03] text-foreground-muted/50">
      —
    </span>
  );
}

export function ComparisonTable() {
  return (
    <div className="relative mx-auto w-full max-w-3xl">
      {/* Colonne Tavyra mise en avant : repère visuel immédiat, même logique
          que la carte Pro de la section tarifs (bordure dégradée). */}
      <div
        aria-hidden
        className="absolute inset-y-0 left-[38.5%] w-[20.5%] rounded-2xl bg-gradient-to-b from-accent-violet/[0.09] to-accent-blue/[0.06] max-sm:hidden"
      />
      <div className="relative overflow-hidden rounded-[28px] border border-border-subtle bg-white/[0.02]">
        <div className="grid grid-cols-[1.6fr_1fr_1fr_1fr] items-center gap-2 border-b border-border-subtle bg-white/[0.02] px-4 py-4 sm:px-6">
          <span className="text-xs font-medium text-foreground-muted">&nbsp;</span>
          <span className="flex items-center justify-center gap-1.5 text-center text-sm font-semibold text-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-br from-accent-blue to-accent-violet" />
            Tavyra
          </span>
          <span className="text-center text-xs text-foreground-muted">Chatbot</span>
          <span className="text-center text-xs text-foreground-muted">Cours en ligne</span>
        </div>
        {ROWS.map((row, i) => (
          <div
            key={row.label}
            className={`grid grid-cols-[1.6fr_1fr_1fr_1fr] items-center gap-2 px-4 py-4 sm:px-6 ${
              i % 2 === 1 ? "bg-white/[0.015]" : ""
            }`}
          >
            <span className="text-sm text-foreground">{row.label}</span>
            <span className="flex justify-center">
              <CellMark value={row.lia} />
            </span>
            <span className="flex justify-center">
              <CellMark value={row.chatbot} />
            </span>
            <span className="flex justify-center">
              <CellMark value={row.course} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
