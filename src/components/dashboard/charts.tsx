// Prompt 06.1 : petits graphiques maison en SVG/CSS (pas de dépendance de
// charting ajoutée pour deux visualisations simples) — même langage visuel
// que l'anneau de score déjà utilisé dans quiz-view.tsx (conic-gradient).

export function ProgressRing({
  percent,
  label,
  sublabel,
}: {
  percent: number;
  label: string;
  sublabel: string;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className="flex items-center gap-4">
      <div
        className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full"
        style={{
          background: `conic-gradient(var(--accent-violet) ${clamped * 3.6}deg, color-mix(in srgb, var(--overlay-base) 6%, transparent) 0deg)`,
        }}
        role="img"
        aria-label={`${label} : ${clamped}%`}
      >
        <div className="flex h-[62px] w-[62px] items-center justify-center rounded-full bg-background-elevated">
          <span className="text-base font-semibold text-foreground">{clamped}%</span>
        </div>
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="mt-0.5 text-xs text-foreground-muted">{sublabel}</p>
      </div>
    </div>
  );
}

/** Petite courbe de tendance (style "Wallet") — purement décorative, tracée
 * à partir d'une série réelle déjà calculée (jamais générée ici). Rend
 * `null` en dessous de 2 points : une courbe à 0 ou 1 point n'a aucun sens. */
export function Sparkline({
  data,
  stroke = "var(--accent-violet-light)",
  className = "",
}: {
  data: number[];
  stroke?: string;
  className?: string;
}) {
  if (data.length < 2) return null;

  const width = 72;
  const height = 26;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      className={className}
      aria-hidden
    >
      <polyline points={points} stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const WEEKDAY_LABELS = ["D", "L", "M", "M", "J", "V", "S"];

export function ActivityBarChart({ data }: { data: { date: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div>
      <div className="flex h-24 items-end gap-1.5">
        {data.map((d) => {
          const heightPercent = d.count === 0 ? 4 : Math.max(10, (d.count / max) * 100);
          const label = new Date(`${d.date}T00:00:00`).toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "short",
          });
          return (
            <div
              key={d.date}
              className="group relative flex h-full flex-1 flex-col items-center justify-end"
            >
              <div
                className={`w-full rounded-t-sm transition-all ${
                  d.count > 0
                    ? "bg-gradient-to-t from-accent-blue to-accent-violet"
                    : "bg-overlay/[0.06]"
                }`}
                style={{ height: `${heightPercent}%` }}
              />
              <span className="pointer-events-none absolute -top-6 whitespace-nowrap rounded-md bg-background px-1.5 py-0.5 text-[10px] text-foreground-muted opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
                {label} · {d.count}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-1.5 text-center text-[10px] text-foreground-muted">
        {data.map((d) => (
          <span key={d.date} className="flex-1">
            {WEEKDAY_LABELS[new Date(`${d.date}T00:00:00`).getDay()]}
          </span>
        ))}
      </div>
    </div>
  );
}
