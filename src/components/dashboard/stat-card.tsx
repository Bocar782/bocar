import type { ReactNode } from "react";
import { Sparkline } from "./charts";
import { CountUp } from "./count-up";

// Prompt 06.2 : carte de stat façon "Wallet" (maquette de référence
// fournie par l'utilisateur) — icône sur puce dégradée colorée, valeur,
// pastille de tendance optionnelle, mini-courbe optionnelle. Toutes les
// données affichées viennent de getDashboardStats (lib/dashboard/stats.ts),
// jamais inventées ici : un trend/sparkline absent (`undefined`/`null`)
// n'est simplement pas rendu plutôt que remplacé par une valeur de secours.
export function StatCard({
  icon,
  gradient,
  label,
  value,
  sublabel,
  trend,
  sparklineData,
  sparklineColor,
}: {
  icon: ReactNode;
  /** Classes Tailwind du dégradé de la puce icône, ex. "from-brand-from via-brand-via to-brand-to". */
  gradient: string;
  label: string;
  value: string;
  sublabel?: string;
  trend?: { direction: "up" | "down"; text: string } | null;
  sparklineData?: number[];
  sparklineColor?: string;
}) {
  return (
    <div className="lift group relative h-full overflow-hidden rounded-2xl border border-border-subtle bg-background-card/80 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_16px_40px_-28px_rgba(16,12,40,0.35)]">
      <div
        aria-hidden
        className={`pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br opacity-20 blur-2xl transition-opacity duration-500 group-hover:opacity-40 ${gradient}`}
      />
      <div className="flex items-start justify-between gap-2">
        <span
          className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_8px_20px_-10px_var(--glow)] ${gradient}`}
        >
          {icon}
        </span>
        {trend && (
          <span
            className={`inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${
              trend.direction === "up"
                ? "bg-success/15 text-success-light"
                : "bg-danger/15 text-danger-light"
            }`}
          >
            {trend.direction === "up" ? "↑" : "↓"} {trend.text}
          </span>
        )}
      </div>

      <p className="relative mt-4 text-xs font-medium text-foreground-muted">{label}</p>

      <div className="mt-1 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-2xl font-semibold tracking-tight text-foreground sm:text-[1.7rem]">
            <CountUp value={value} />
          </p>
          {sublabel && <p className="mt-0.5 truncate text-xs text-foreground-muted">{sublabel}</p>}
        </div>
        {/* Masquée sous sm : sur une grille 2 colonnes en mobile, la carte
            n'a pas la place d'afficher à la fois la valeur en entier ET la
            courbe — la valeur doit toujours primer, jamais être tronquée. */}
        {sparklineData && sparklineData.length >= 2 && (
          <Sparkline
            data={sparklineData}
            stroke={sparklineColor}
            className="mb-0.5 hidden shrink-0 sm:block"
          />
        )}
      </div>
    </div>
  );
}
