import { IconGraduationCap, IconRocket } from "./icons";

const AUDIENCES = [
  {
    Icon: IconGraduationCap,
    title: "Pour les élèves et étudiants",
    points: [
      "Réviser un chapitre du programme ou préparer un examen avec une formation construite sur mesure.",
      "Poser une question à Tavyra pendant la lecture, comme un prof disponible à tout moment.",
      "Vérifier ce que tu as vraiment compris avec un quiz généré à partir du cours.",
    ],
  },
  {
    Icon: IconRocket,
    title: "Pour les entrepreneurs",
    points: [
      "Comprendre rapidement un sujet business avant de te lancer : marketing, finance, juridique...",
      "Des exemples réels d'entreprises, avec leurs sources, plutôt que des généralités.",
      "Aller plus loin avec une analyse approfondie de cas réels (plan Pro).",
    ],
  },
];

export function AudienceBenefits() {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
      {AUDIENCES.map((audience) => (
        <div
          key={audience.title}
          className="h-full rounded-2xl border border-border-subtle bg-white/[0.02] p-6 sm:p-8"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-accent-blue/15 to-accent-violet/15 text-accent-violet-light">
            <audience.Icon width={22} height={22} />
          </span>
          <h3 className="mt-4 text-lg font-semibold text-foreground">{audience.title}</h3>
          <ul className="mt-4 space-y-2.5 text-sm leading-relaxed text-foreground-muted">
            {audience.points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
