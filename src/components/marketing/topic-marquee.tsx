// Bandeau défilant d'exemples de sujets — illustre l'étendue des domaines
// possibles (n'importe quel sujet peut être demandé), sans jamais
// prétendre qu'il s'agit de formations populaires ou de statistiques.
const TOPICS = [
  "Le marketing digital",
  "La Révolution française",
  "Python pour débutants",
  "Investir en bourse",
  "Le droit constitutionnel",
  "Créer sa boutique en ligne",
  "La physique quantique",
  "Négocier un salaire",
  "L'histoire de l'art",
  "La comptabilité",
  "Le machine learning",
  "La philosophie de Kant",
];

export function TopicMarquee() {
  const row = [...TOPICS, ...TOPICS];
  return (
    <div className="marquee overflow-hidden py-2" aria-label="Exemples de sujets">
      <ul className="marquee-track gap-3">
        {row.map((topic, i) => (
          <li
            key={`${topic}-${i}`}
            aria-hidden={i >= TOPICS.length}
            className="glass-card flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm text-foreground-muted"
          >
            <span className="bg-brand h-1.5 w-1.5 rounded-full" />
            {topic}
          </li>
        ))}
      </ul>
    </div>
  );
}
