const BENEFITS = [
  {
    icon: "🎯",
    title: "Apprends à ton rythme",
    description: "Chaque formation est adaptée à ton niveau : débutant, intermédiaire ou avancé.",
  },
  {
    icon: "🧠",
    title: "Comprends vraiment",
    description: "Des explications progressives et détaillées, pas de résumé superficiel.",
  },
  {
    icon: "🔍",
    title: "Des exemples concrets",
    description: "Des cas pratiques réels, avec leurs sources, pour ancrer la théorie dans le réel.",
  },
  {
    icon: "✅",
    title: "Teste tes connaissances",
    description: "Un quiz généré automatiquement à partir du contenu réel de ta formation.",
  },
  {
    icon: "💬",
    title: "Ton assistant personnel",
    description: "Lia reste disponible pour répondre à tes questions, chapitre par chapitre.",
  },
  {
    icon: "🔭",
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
          <span className="text-2xl">{benefit.icon}</span>
          <h3 className="mt-4 text-base font-semibold text-foreground">{benefit.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-foreground-muted">
            {benefit.description}
          </p>
        </div>
      ))}
    </div>
  );
}
