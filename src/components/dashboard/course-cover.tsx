import type { ReactNode } from "react";

// Prompt 06.3 : vignette de formation — un dégradé abstrait déterministe
// (dérivé de l'id réel de la formation, jamais aléatoire ni une photo
// inventée) + une icône. Purement décoratif, ne prétend jamais être une
// vraie image du contenu — contrairement à une maquette qui afficherait
// une photo stock sans rapport avec la formation.
const GRADIENTS = [
  "from-accent-blue to-accent-violet",
  "from-accent-violet to-accent-violet-light",
  "from-success to-accent-blue",
  "from-warning to-accent-violet",
  "from-accent-blue-light to-accent-violet",
  "from-success-light to-accent-blue",
];

function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function CourseCover({
  seed,
  icon,
  className = "",
}: {
  seed: string;
  icon: ReactNode;
  className?: string;
}) {
  const gradient = GRADIENTS[hashSeed(seed) % GRADIENTS.length];
  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br text-white/90 ${gradient} ${className}`}
    >
      <div aria-hidden className="absolute inset-0 bg-black/10" />
      <span className="relative">{icon}</span>
    </div>
  );
}
