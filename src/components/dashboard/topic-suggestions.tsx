import Link from "next/link";

// Idées de sujets en un clic : ouvrent la page de création avec le sujet
// déjà rempli (`?sujet=`), pour lancer un premier diagnostic sans avoir à
// chercher quoi écrire.
const SUGGESTIONS = [
  "Le marketing digital",
  "Investir en bourse",
  "Créer sa boutique en ligne",
  "Python pour débutants",
  "La Révolution française",
  "Prendre la parole en public",
];

export function TopicSuggestions({ className = "" }: { className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs font-medium text-foreground-muted">
        Pas d&apos;idée ? Lance-toi avec un de ces sujets :
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {SUGGESTIONS.map((topic) => (
          <Link
            key={topic}
            href={`/dashboard/creer?sujet=${encodeURIComponent(topic)}`}
            className="group inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-background-card/80 px-3.5 py-1.5 text-sm text-foreground transition-all hover:-translate-y-0.5 hover:border-accent-violet/50 hover:shadow-[0_8px_20px_-12px_var(--glow)]"
          >
            <span className="bg-brand h-1.5 w-1.5 rounded-full" />
            {topic}
            <span className="text-accent-violet-light opacity-0 transition-opacity group-hover:opacity-100">
              →
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
