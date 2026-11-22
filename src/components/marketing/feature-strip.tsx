import { IconBrain, IconChartLine, IconExample, IconTarget } from "./icons";

// Version condensée de l'ancienne grille à 6 cartes (`benefits.tsx`,
// conservé mais plus utilisé sur la page d'accueil) — Prompt 05.25,
// direction artistique premium : un seul bandeau à bordure fine plutôt que
// des cartes individuelles très arrondies. Seulement des bénéfices déjà
// vérifiés dans le code (voir `src/lib/courses/plan.ts` /
// `src/components/marketing/benefits.tsx`) : jamais de promesse comme
// "accès à vie", qui ne correspond à aucun fonctionnement réel des offres.
const FEATURES = [
  {
    Icon: IconBrain,
    title: "IA avancée",
    description: "Un contenu rédigé spécifiquement pour ton sujet, pas une réponse générique.",
  },
  {
    Icon: IconTarget,
    title: "Contenu structuré",
    description: "Chapitres progressifs, adaptés à ton niveau, du premier concept à la synthèse.",
  },
  {
    Icon: IconExample,
    title: "Exemples concrets",
    description: "Des cas réels, vérifiés et sourcés, plutôt que des généralités.",
  },
  {
    Icon: IconChartLine,
    title: "Suivi de progression",
    description: "Chaque chapitre lu, chaque quiz passé, visible d'un coup d'œil.",
  },
] as const;

export function FeatureStrip() {
  return (
    <div className="grid grid-cols-1 divide-y divide-border-subtle overflow-hidden rounded-2xl border border-border-subtle sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
      {FEATURES.map((feature) => (
        <div key={feature.title} className="flex flex-col gap-3 p-6">
          <feature.Icon width={20} height={20} className="text-accent-violet-light" />
          <h3 className="text-sm font-semibold text-foreground">{feature.title}</h3>
          <p className="text-sm leading-relaxed text-foreground-muted">{feature.description}</p>
        </div>
      ))}
    </div>
  );
}
