// `variant` par défaut ("dark") : rendu strictement identique à avant pour
// toutes les pages existantes (dashboard, pricing, pourquoi-nous...).
// "light" (Prompt 05.27) n'est utilisé que par la landing : plus d'aurora
// animée ni de grille de points, seulement un grain papier statique.
export function BackgroundGlow({ variant = "dark" }: { variant?: "dark" | "light" }) {
  if (variant === "light") {
    return (
      <div aria-hidden className="fixed inset-0 -z-10">
        <div className="paper-grain" />
      </div>
    );
  }

  return (
    <div aria-hidden className="fixed inset-0 -z-10">
      <div className="aurora" />
      <div className="grid-overlay" />
      <div className="grain-overlay" />
    </div>
  );
}
