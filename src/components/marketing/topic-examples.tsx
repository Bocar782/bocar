const TOPICS = [
  { emoji: "🚀", domain: "Business", title: "Créer son entreprise" },
  { emoji: "🛒", domain: "E-commerce", title: "Créer une boutique en ligne" },
  { emoji: "📈", domain: "Finance", title: "Comprendre les marchés financiers" },
  { emoji: "📣", domain: "Marketing", title: "Maîtriser la publicité en ligne" },
  { emoji: "🏛️", domain: "Histoire", title: "Comprendre la Révolution française" },
  { emoji: "⚛️", domain: "Sciences", title: "Comprendre la physique" },
  { emoji: "🎓", domain: "Études", title: "Préparer un examen" },
];

export function TopicExamples() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {TOPICS.map((topic) => (
        <div
          key={topic.title}
          className="group rounded-2xl border border-border-subtle bg-white/[0.02] p-5 transition-colors hover:border-white/15 hover:bg-white/[0.04]"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.04] text-lg">
            {topic.emoji}
          </span>
          <span className="mt-4 block text-xs font-medium uppercase tracking-wide text-accent-violet-light">
            {topic.domain}
          </span>
          <p className="mt-1 text-base font-medium text-foreground">{topic.title}</p>
        </div>
      ))}
    </div>
  );
}
