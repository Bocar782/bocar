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
      <div className="glass-card gradient-border lift relative overflow-hidden rounded-2xl p-7 sm:p-8">
        <div
          aria-hidden
          className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-accent-violet/20 blur-3xl"
        />
        <span className="bg-brand relative flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_8px_20px_-8px_var(--glow)]">
          <IconGraduationCap width={20} height={20} />
        </span>
        <h3 className="relative mt-5 text-lg font-semibold text-foreground">Pour les élèves et étudiants</h3>
        <ul className="mt-4 space-y-3 text-sm leading-relaxed text-foreground-muted">
          {STUDENT_POINTS.map((point) => (
            <li key={point} className="flex gap-2.5">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-violet/20 text-[11px] text-accent-violet-light">✓</span>
              <span>{point}</span>
            </li>
          ))}
        </ul>
        <div className="mt-6">
          {/* Prompt 06.42 (retour utilisateur réel : un court "à retenir"
              isolé laissait croire qu'une leçon tenait en une phrase) :
              seulement le repère de structure (numéro + titre du
              chapitre), jamais un extrait de contenu qui pourrait passer
              pour l'intégralité de la leçon. */}
          <MockFrame label="Formation">
            <span className="text-[11px] font-mono text-accent-violet-light">Chapitre 2</span>
            <p className="mt-1 text-sm font-semibold text-foreground">La diversification du portefeuille</p>
          </MockFrame>
        </div>
      </div>

      {/* Entrepreneurs : même carte que les étudiants (Prompt 05.34) —
          texte en haut, aperçu en bas, même filet dégradé. */}
      <div className="glass-card gradient-border lift relative overflow-hidden rounded-2xl p-7 sm:p-8">
        <div
          aria-hidden
          className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-accent-violet/20 blur-3xl"
        />
        <span className="bg-brand relative flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_8px_20px_-8px_var(--glow)]">
          <IconRocket width={20} height={20} />
        </span>
        <h3 className="relative mt-5 text-lg font-semibold text-foreground">Pour les entrepreneurs</h3>
        <ul className="mt-4 space-y-3 text-sm leading-relaxed text-foreground-muted">
          {ENTREPRENEUR_POINTS.map((point) => (
            <li key={point} className="flex gap-2.5">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-violet/20 text-[11px] text-accent-violet-light">✓</span>
              <span>{point}</span>
            </li>
          ))}
        </ul>
        <div className="mt-6">
          {/* Prompt 06.42 (retour utilisateur réel : un seul échange
              question/réponse donnait l'impression que le chat se résume
              à ça) : seulement le champ de saisie, jamais un exemple de
              conversation qui pourrait passer pour toute l'étendue du chat. */}
          <MockFrame label="Chat avec Tavyra">
            <div className="rounded-lg border border-border-subtle bg-white/[0.03] px-3 py-2.5 text-xs text-foreground-muted">
              Pose n&apos;importe quelle question sur ce chapitre...
            </div>
          </MockFrame>
        </div>
      </div>
    </div>
  );
}
