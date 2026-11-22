import { IconBrain, IconCheck, IconExample, IconTarget } from "./icons";

// Prompt 05.27 : bandeau à filets, sans cartes — rupture volontaire avec le
// motif "carte à bordure/rayon" répété ailleurs sur la page (voir
// benefits.tsx, dont les 4 premiers bénéfices sont repris ici tels quels,
// déjà vérifiés comme réels). Desktop/laptop : une ligne, filets verticaux.
// Tablette : 2x2. Mobile : liste verticale, filets horizontaux.
const FEATURES = [
  {
    Icon: IconTarget,
    title: "Apprends à ton rythme",
    description: "Chaque formation est adaptée à ton niveau : débutant, intermédiaire ou avancé.",
  },
  {
    Icon: IconBrain,
    title: "Comprends vraiment",
    description: "Des explications progressives et détaillées, pas de résumé superficiel.",
  },
  {
    Icon: IconExample,
    title: "Des exemples concrets",
    description: "Des cas réels, avec leurs sources, pour ancrer la théorie dans la pratique.",
  },
  {
    Icon: IconCheck,
    title: "Teste tes connaissances",
    description: "Un quiz généré automatiquement à partir du contenu réel de ta formation.",
  },
] as const;

export function FeatureBand() {
  return (
    <div className="grid grid-cols-1 divide-y divide-border-subtle sm:grid-cols-2 sm:gap-x-10 lg:grid-cols-4 lg:gap-x-0 lg:divide-x lg:divide-y-0">
      {FEATURES.map((feature) => (
        <div key={feature.title} className="flex flex-col gap-2.5 py-6 first:pt-0 lg:px-8 lg:py-0 lg:first:pl-0">
          <feature.Icon width={18} height={18} className="text-accent-violet" />
          <h3 className="text-sm font-semibold text-foreground">{feature.title}</h3>
          <p className="text-sm leading-relaxed text-foreground-muted">{feature.description}</p>
        </div>
      ))}
    </div>
  );
}
