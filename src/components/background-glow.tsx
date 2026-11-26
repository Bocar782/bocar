// "dark" : pages publiques secondaires (tarifs, connexion, légal...) et
// pages de lecture. "light" : landing — halos lumineux animés qui restent
// dans le viewport pendant le défilement, pour que chaque section garde de
// la lumière plutôt qu'un aplat violet uniforme. Le parent doit créer un
// contexte d'empilement (classe `isolate`) pour que ce calque -z-10 reste
// au-dessus de son propre fond.
export function BackgroundGlow({ variant = "dark" }: { variant?: "dark" | "light" }) {
  if (variant === "light") {
    return (
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div className="landing-aurora">
          <span />
          <span />
          <span />
        </div>
        <div className="paper-grain" />
      </div>
    );
  }

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
      <div className="aurora" />
      <div className="grid-overlay" />
      <div className="grain-overlay" />
    </div>
  );
}
