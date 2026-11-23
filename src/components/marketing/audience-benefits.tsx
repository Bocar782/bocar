import { MockFrame } from "./interface-showcase";
import { IconGraduationCap, IconRocket } from "./icons";

// Prompt 05.27 : deux compositions, aperçus produit réels (jamais inventés).
// Prompt 05.29 : plus d'assombrissement séparé — toute la landing est
// désormais violet foncé. Prompt 05.34 : les deux cartes (étudiants /
// entrepreneurs) utilisent désormais exactement la même structure (carte,
// icône, titre, liste, aperçu en bas) — l'asymétrie d'origine créait un
// "désaccord" visuel sur mobile une fois les colonnes empilées (l'aperçu
// se retrouvait en haut d'un côté et en bas de l'autre).

const STUDENT_POINTS = [
  "Réviser un chapitre du programme ou préparer un examen avec une formation construite sur mesure.",
  "Poser une question à Tavyra pendant la lecture, comme un prof disponible à tout moment.",
  "Vérifier ce que tu as vraiment compris avec un quiz généré à partir du cours.",
];

const ENTREPRENEUR_POINTS = [
  "Comprendre rapidement un sujet business avant de te lancer : marketing, finance, juridique...",
  "Des exemples réels d'entreprises, avec leurs sources, plutôt que des généralités.",
  "Aller plus loin avec une analyse approfondie de cas réels (plan Pro).",
];

export function AudienceBenefits() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Étudiants : carte, texte en haut, aperçu en bas. Prompt 05.30 :
          petit filet dégradé brillant en haut de carte. */}
      <div className="relative overflow-hidden rounded-xl border border-border-subtle bg-background-card p-7 shadow-[0_1px_2px_rgba(28,26,34,0.04),0_8px_24px_-16px_rgba(28,26,34,0.12)] sm:p-8">
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-[#8b5cf6] via-accent-violet to-[#8b5cf6]"
        />
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-violet-tint text-accent-violet">
          <IconGraduationCap width={20} height={20} />
        </span>
        <h3 className="mt-4 text-lg font-semibold text-foreground">Pour les élèves et étudiants</h3>
        <ul className="mt-4 space-y-3 text-sm leading-relaxed text-foreground-muted">
          {STUDENT_POINTS.map((point) => (
            <li key={point} className="flex gap-2.5">
              <span className="mt-0.5 shrink-0 text-accent-violet">✓</span>
              <span>{point}</span>
            </li>
          ))}
        </ul>
        <div className="mt-6">
          <MockFrame label="Formation">
            <span className="text-[11px] font-mono text-accent-violet-light">Chapitre 2</span>
            <p className="mt-1 text-sm font-semibold text-foreground">La diversification du portefeuille</p>
            <div className="mt-2 rounded-lg border border-accent-violet/25 bg-accent-violet/[0.08] p-2.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-accent-violet-light">
                À retenir
              </span>
              <p className="mt-1 text-xs text-foreground-muted">
                Ne jamais tout miser sur un seul actif ou secteur.
              </p>
            </div>
          </MockFrame>
        </div>
      </div>

      {/* Entrepreneurs : même carte que les étudiants (Prompt 05.34) —
          texte en haut, aperçu en bas, même filet dégradé. */}
      <div className="relative overflow-hidden rounded-xl border border-border-subtle bg-background-card p-7 shadow-[0_1px_2px_rgba(28,26,34,0.04),0_8px_24px_-16px_rgba(28,26,34,0.12)] sm:p-8">
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-[#8b5cf6] via-accent-violet to-[#8b5cf6]"
        />
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-violet-tint text-accent-violet">
          <IconRocket width={20} height={20} />
        </span>
        <h3 className="mt-4 text-lg font-semibold text-foreground">Pour les entrepreneurs</h3>
        <ul className="mt-4 space-y-3 text-sm leading-relaxed text-foreground-muted">
          {ENTREPRENEUR_POINTS.map((point) => (
            <li key={point} className="flex gap-2.5">
              <span className="mt-0.5 shrink-0 text-accent-violet">✓</span>
              <span>{point}</span>
            </li>
          ))}
        </ul>
        <div className="mt-6">
          <MockFrame label="Chat avec Tavyra">
            <div className="space-y-2">
              <div className="ml-auto max-w-[80%] rounded-lg rounded-tr-sm bg-white/[0.06] px-3 py-2 text-xs text-foreground">
                C&apos;est quoi un ETF concrètement ?
              </div>
              <div className="max-w-[85%] rounded-lg rounded-tl-sm bg-accent-violet/10 px-3 py-2 text-xs text-foreground">
                Un panier d&apos;actifs que tu achètes en une seule fois, comme un
                mini-portefeuille déjà diversifié.
              </div>
            </div>
          </MockFrame>
        </div>
      </div>
    </div>
  );
}
