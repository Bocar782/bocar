import { MockFrame } from "./interface-showcase";
import { IconGraduationCap, IconRocket } from "./icons";

// Prompt 05.25 : recentré sur les deux publics principaux de Tavyra
// (entrepreneurs, étudiants) — plus de troisième catégorie générique.
// Chaque carte inclut désormais un aperçu RÉEL de l'interface (réutilise
// les mockups de `interface-showcase.tsx`, jamais une photo de banque
// d'images générique) plutôt qu'un simple bloc de texte.
const AUDIENCES = [
  {
    Icon: IconGraduationCap,
    title: "Pour les élèves et étudiants",
    points: [
      "Réviser un chapitre du programme ou préparer un examen avec une formation construite sur mesure.",
      "Poser une question à Tavyra pendant la lecture, comme un prof disponible à tout moment.",
      "Vérifier ce que tu as vraiment compris avec un quiz généré à partir du cours.",
    ],
    preview: (
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
    ),
  },
  {
    Icon: IconRocket,
    title: "Pour les entrepreneurs",
    points: [
      "Comprendre rapidement un sujet business avant de te lancer : marketing, finance, juridique...",
      "Des exemples réels d'entreprises, avec leurs sources, plutôt que des généralités.",
      "Aller plus loin avec une analyse approfondie de cas réels (plan Pro).",
    ],
    preview: (
      <MockFrame label="Générateur">
        <p className="text-sm text-foreground-muted">Que veux-tu apprendre ?</p>
        <p className="typing-caret mt-2 text-base text-foreground">Lever des fonds pour ma startup</p>
        <div className="mt-4 flex justify-end">
          <span className="rounded-full bg-gradient-to-r from-accent-blue to-accent-violet px-4 py-2 text-xs font-semibold text-white">
            Générer ma formation
          </span>
        </div>
      </MockFrame>
    ),
  },
];

export function AudienceBenefits() {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
      {AUDIENCES.map((audience) => (
        <div
          key={audience.title}
          className="flex h-full flex-col gap-6 rounded-2xl border border-border-subtle bg-white/[0.02] p-6 sm:p-8"
        >
          <div>
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-accent-blue/15 to-accent-violet/15 text-accent-violet-light">
              <audience.Icon width={22} height={22} />
            </span>
            <h3 className="mt-4 text-lg font-semibold text-foreground">{audience.title}</h3>
            <ul className="mt-4 space-y-3 text-sm leading-relaxed text-foreground-muted">
              {audience.points.map((point) => (
                <li key={point} className="flex gap-2.5">
                  <span className="mt-0.5 shrink-0 text-accent-violet-light">✓</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-auto">{audience.preview}</div>
        </div>
      ))}
    </div>
  );
}
