import {
  IconBrain,
  IconChat,
  IconCheck,
  IconExample,
  IconTarget,
  IconTelescope,
} from "./icons";

const BENEFITS = [
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
    description: "Des cas pratiques réels, avec leurs sources, pour ancrer la théorie dans le réel.",
  },
  {
    Icon: IconCheck,
    title: "Teste tes connaissances",
    description: "Un quiz généré automatiquement à partir du contenu réel de ta formation.",
  },
  {
    Icon: IconChat,
    title: "Ton assistant personnel",
    description: "Lia reste disponible pour répondre à tes questions, chapitre par chapitre.",
  },
  {
    Icon: IconTelescope,
    title: "Va plus loin",
    description: "Des analyses approfondies sur des cas réels, pour creuser un sujet en profondeur.",
  },
];

export function Benefits() {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {BENEFITS.map((benefit) => (
        <div
          key={benefit.title}
          className="relative overflow-hidden rounded-2xl border border-border-subtle bg-white/[0.02] p-6"
        >
          <div
            aria-hidden
            className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-accent-violet/10 blur-2xl"
          />
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-accent-blue/15 to-accent-violet/15 text-accent-violet-light">
            <benefit.Icon width={22} height={22} />
          </span>
          <h3 className="mt-4 text-base font-semibold text-foreground">{benefit.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-foreground-muted">
            {benefit.description}
          </p>
        </div>
      ))}
    </div>
  );
}
