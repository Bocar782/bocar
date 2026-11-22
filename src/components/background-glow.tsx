// `variant` par défaut ("dark") : rendu strictement identique à avant pour
// toutes les pages existantes (dashboard, pricing, pourquoi-nous...).
// "light" (Prompt 05.26) n'est utilisé que par la landing page.
export function BackgroundGlow({ variant = "dark" }: { variant?: "dark" | "light" }) {
  const isLight = variant === "light";
  return (
    <div aria-hidden className="fixed inset-0 -z-10">
      <div className={isLight ? "aurora-light" : "aurora"} />
      <div className={isLight ? "grid-overlay-light" : "grid-overlay"} />
      <div className={isLight ? "grain-overlay-light" : "grain-overlay"} />
    </div>
  );
}
