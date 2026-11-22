import { MockFrame } from "./interface-showcase";

// Prompt 05.27 : mise en scène éditoriale du hero — deux aperçus RÉELS de
// l'interface Tavyra (mêmes contenus que interface-showcase.tsx, jamais
// inventés), composition volontairement simple : un cadre principal, un
// second plus petit qui chevauche légèrement son coin inférieur gauche.
// Sur mobile, seul le cadre principal est affiché (pas de chevauchement).
// Prompt 05.29 : theme-dark-accent retiré — la landing est désormais
// pleinement violet foncé, plus besoin d'un îlot sombre en contraste.
export function HeroShowcase() {
  return (
    <div className="relative mx-auto w-full max-w-md pb-28 lg:max-w-none">
      <MockFrame
        label="Tableau de bord"
        className="relative z-10 w-full shadow-[0_32px_70px_-28px_rgba(28,26,34,0.45)]"
      >
        <div className="flex items-center justify-between rounded-lg border border-border-subtle bg-white/[0.02] px-3.5 py-2.5">
          <span className="text-xs text-foreground-muted">Plan Pro</span>
          <span className="text-xs font-medium text-foreground">2/3 formations générées</span>
        </div>
        <div className="mt-3.5 grid gap-2 sm:grid-cols-3">
          {[
            { title: "Créer sa boutique en ligne", pct: 100 },
            { title: "Comprendre les marchés financiers", pct: 62 },
            { title: "La Révolution française", pct: 18 },
          ].map((course) => (
            <div
              key={course.title}
              className="rounded-lg border border-border-subtle bg-white/[0.02] p-2.5"
            >
              <p className="truncate text-xs font-medium text-foreground">{course.title}</p>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full bg-accent-violet"
                  style={{ width: `${course.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </MockFrame>

      <MockFrame
        label="Générateur"
        className="absolute left-8 z-20 hidden w-44 shadow-[0_22px_50px_-20px_rgba(28,26,34,0.5)] sm:block lg:left-12"
        style={{ top: "calc(100% - 2rem)" }}
      >
        <p className="text-[11px] text-foreground-muted">Que veux-tu apprendre ?</p>
        <p className="typing-caret mt-1.5 text-xs font-medium text-foreground">
          Les bases de l&apos;investissement
        </p>
      </MockFrame>
    </div>
  );
}
