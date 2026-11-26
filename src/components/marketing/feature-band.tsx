import { IconBrain, IconCheck, IconExample, IconTarget } from "./icons";

// Les 4 bénéfices déjà vérifiés comme réels (voir benefits.tsx), présentés
// en cartes de verre avec une puce lumineuse.
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
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {FEATURES.map((feature) => (
        <div
          key={feature.title}
          className="glass-card lift group relative overflow-hidden rounded-2xl p-6"
        >
          <div
            aria-hidden
            className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-accent-violet/20 opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
          />
          <span className="bg-brand relative flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_8px_20px_-8px_var(--glow)]">
            <feature.Icon width={20} height={20} />
          </span>
          <h3 className="relative mt-5 text-base font-semibold text-foreground">{feature.title}</h3>
          <p className="relative mt-2 text-sm leading-relaxed text-foreground-muted">
            {feature.description}
          </p>
        </div>
      ))}
    </div>
  );
}
