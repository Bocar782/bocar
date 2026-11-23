import type { ReactNode } from "react";
import { Sparkline } from "./charts";

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
  /** Classes Tailwind du dégradé de la puce icône, ex. "from-accent-blue to-accent-violet". */
  gradient: string;
  label: string;
  value: string;
  sublabel?: string;
  trend?: { direction: "up" | "down"; text: string } | null;
  sparklineData?: number[];
  sparklineColor?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border-subtle bg-background-card p-5">
      <div className="flex items-start justify-between gap-2">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-[0_6px_18px_-8px_rgba(139,92,246,0.55)] ${gradient}`}
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

      <p className="mt-4 text-xs font-medium text-foreground-muted">{label}</p>

      <div className="mt-1 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-2xl font-semibold text-foreground">{value}</p>
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
