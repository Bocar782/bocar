const CHAPTERS = [
  { title: "Choisir sa niche et valider son marché", done: true },
  { title: "Créer sa boutique et son catalogue produits", done: true },
  { title: "Acquisition : SEO, publicité et réseaux sociaux", done: false },
  { title: "Logistique, paiement et service client", done: false },
];

export function WowDemo() {
  return (
    <div className="relative mx-auto w-full max-w-4xl">
      <div
        aria-hidden
        className="absolute -inset-4 -z-10 rounded-[40px] bg-gradient-to-br from-accent-blue/20 via-transparent to-accent-violet/20 blur-2xl"
      />
      <div className="overflow-hidden rounded-[28px] border border-border-subtle bg-background-elevated/80 shadow-[0_40px_120px_-40px_rgba(76,124,243,0.35)] backdrop-blur-xl">
        {/* Barre de fenêtre, pour ancrer visuellement "produit réel" */}
        <div className="flex items-center gap-1.5 border-b border-border-subtle px-5 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
          <span className="ml-3 text-xs text-foreground-muted">dashboard.lia.app</span>
        </div>

        <div className="grid gap-0 p-5 sm:p-8 md:grid-cols-2 md:gap-8">
          {/* Côté gauche : la demande, façon input réel du produit */}
          <div className="flex flex-col justify-center">
            <span className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
              Toi
            </span>
            <p className="typing-caret mt-3 text-xl font-medium leading-snug text-foreground sm:text-2xl">
              Génère-moi une formation sur le e-commerce
            </p>

            <div className="mt-6 flex items-center gap-2 text-sm text-accent-violet-light">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-violet opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-accent-violet" />
              </span>
              Lia construit ta formation...
            </div>

            <p className="mt-6 max-w-sm text-sm leading-relaxed text-foreground-muted">
              Pas une réponse de chatbot : un vrai parcours structuré, avec
              chapitres progressifs, exemples concrets et quiz de validation —
              généré en quelques minutes.
            </p>
          </div>

          {/* Côté droit : aperçu de la formation générée */}
          <div className="rounded-2xl border border-border-subtle bg-white/[0.02] p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2 text-xs text-foreground-muted">
              <span className="rounded-full border border-border-subtle bg-white/[0.03] px-2.5 py-1">
                e-commerce
              </span>
              <span className="rounded-full border border-border-subtle bg-white/[0.03] px-2.5 py-1">
                Niveau débutant
              </span>
            </div>
            <h3 className="mt-3 text-lg font-semibold tracking-tight text-foreground">
              Créer sa boutique en ligne, de l&apos;idée au premier client
            </h3>

            <ul className="mt-4 space-y-2.5">
              {CHAPTERS.map((chapter) => (
                <li key={chapter.title} className="flex items-start gap-2.5 text-sm">
                  <span
                    className={
                      chapter.done
                        ? "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent-blue to-accent-violet text-[10px] text-white"
                        : "mt-0.5 h-4 w-4 shrink-0 rounded-full border border-border-subtle"
                    }
                  >
                    {chapter.done ? "✓" : ""}
                  </span>
                  <span className={chapter.done ? "text-foreground" : "text-foreground-muted"}>
                    {chapter.title}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-4 rounded-xl border border-l-4 border-border-subtle border-l-accent-blue/50 bg-white/[0.03] p-3">
              <span className="text-[11px] font-medium uppercase tracking-wide text-accent-blue-light">
                Exemple concret
              </span>
              <p className="mt-1 text-xs leading-relaxed text-foreground-muted">
                Comment Shopify a aidé des milliers de créateurs à lancer leur
                boutique sans compétences techniques.
              </p>
            </div>

            <div className="mt-4 rounded-xl border border-accent-violet/25 bg-accent-violet/[0.08] p-3">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-accent-violet-light">
                Quiz · Question 3/10
              </span>
              <p className="mt-1.5 text-xs text-foreground">
                Quel indicateur mesure le taux de visiteurs qui achètent ?
              </p>
              <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px]">
                <span className="rounded-lg border border-border-subtle bg-white/[0.02] px-2 py-1.5 text-foreground-muted">
                  Trafic
                </span>
                <span className="rounded-lg border border-accent-violet/40 bg-accent-violet/15 px-2 py-1.5 text-accent-violet-light">
                  Taux de conversion ✓
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
