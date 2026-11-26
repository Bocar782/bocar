import { IconAtom, IconCart, IconChartLine, IconCheck, IconLandmark } from "./icons";

// Mise en scène du hero : un aperçu de l'interface réelle de Tavyra (même
// structure que le tableau de bord : formations en cours + progression),
// entouré de trois vignettes flottantes qui reprennent des éléments
// existants du produit (génération en 8 étapes, générateur, quiz de module).
// Les valeurs sont illustratives — c'est un aperçu d'interface, jamais
// présenté comme une statistique d'utilisateurs.
const COURSES = [
  { title: "Créer sa boutique en ligne", meta: "8 chapitres", pct: 100, Icon: IconCart },
  { title: "Comprendre les marchés financiers", meta: "7 chapitres", pct: 62, Icon: IconChartLine },
  { title: "La Révolution française", meta: "6 chapitres", pct: 18, Icon: IconLandmark },
];

export function HeroShowcase() {
  return (
    <div className="relative mx-auto w-full max-w-lg py-6 lg:max-w-none lg:py-10">
      <div
        aria-hidden
        className="absolute inset-0 -z-10 scale-110 rounded-full bg-[radial-gradient(closest-side,rgba(157,107,255,0.5),transparent)] blur-3xl"
      />

      <div className="float-y">
        <div className="glass-solid gradient-border relative overflow-hidden rounded-2xl">
          <div className="flex items-center gap-1.5 border-b border-border-subtle px-4 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]/80" />
            <span className="ml-3 text-xs text-foreground-muted">Tableau de bord</span>
            <span className="ml-auto mr-0 rounded-full bg-accent-violet/20 px-2.5 py-0.5 text-[11px] font-semibold text-accent-violet-light">
              Plan Pro
            </span>
          </div>

          <div className="p-5 sm:p-6">
            <p className="text-sm font-semibold text-foreground">Reprends là où tu t&apos;es arrêté</p>
            <p className="mt-0.5 text-xs text-foreground-muted">3 formations dans ta bibliothèque</p>

            <ul className="mt-5 space-y-3">
              {COURSES.map((course, i) => (
                <li
                  key={course.title}
                  className="flex items-center gap-3.5 rounded-xl border border-border-subtle bg-white/[0.03] p-3"
                >
                  <span className="bg-brand flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white shadow-[0_6px_18px_-8px_var(--glow)]">
                    <course.Icon width={18} height={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="truncate text-sm font-medium text-foreground">{course.title}</p>
                      <span className="shrink-0 text-xs font-semibold text-accent-violet-light">
                        {course.pct}%
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                      <div
                        className="fill-in bg-brand h-full rounded-full"
                        style={{ width: `${course.pct}%`, ["--d" as string]: `${500 + i * 180}ms` }}
                      />
                    </div>
                    <p className="mt-1.5 text-[11px] text-foreground-muted">{course.meta}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Vignette : génération en cours */}
      <div className="float-y-slow absolute -right-2 -top-6 z-10 hidden sm:block lg:-right-8 lg:-top-4">
        <div className="glass-solid flex items-center gap-3 rounded-xl px-4 py-3">
          <span className="relative flex h-8 w-8 items-center justify-center">
            <span className="absolute inset-0 animate-spin rounded-full border-2 border-accent-violet/25 border-t-accent-violet-light" />
            <IconAtom width={14} height={14} className="text-accent-violet-light" />
          </span>
          <div>
            <p className="text-xs font-semibold text-foreground">Génération en cours</p>
            <p className="text-[11px] text-foreground-muted">Rédaction des chapitres…</p>
          </div>
        </div>
      </div>

      {/* Vignette : générateur */}
      <div className="float-y-slow absolute -bottom-10 -left-3 z-10 hidden w-56 sm:block lg:-left-2">
        <div className="glass-solid rounded-xl px-4 py-3.5">
          <p className="text-[11px] text-foreground-muted">Que veux-tu apprendre ?</p>
          <p className="typing-caret mt-1 text-sm font-medium text-foreground">
            Les bases de l&apos;investissement
          </p>
        </div>
      </div>

      {/* Vignette : quiz de module */}
      <div className="float-y absolute -bottom-6 right-4 z-10 hidden sm:block lg:-right-6">
        <div className="glass-solid flex items-center gap-2.5 rounded-xl px-3.5 py-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-success/20 text-success-light">
            <IconCheck width={14} height={14} />
          </span>
          <p className="text-xs font-semibold text-foreground">Quiz de module réussi</p>
        </div>
      </div>
    </div>
  );
}
