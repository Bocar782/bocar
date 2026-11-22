export function MockFrame({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-border-subtle bg-background-elevated/80 ${className}`}
    >
      <div className="flex items-center gap-1.5 border-b border-border-subtle px-4 py-2.5">
        <span className="h-2 w-2 rounded-full bg-white/10" />
        <span className="h-2 w-2 rounded-full bg-white/10" />
        <span className="h-2 w-2 rounded-full bg-white/10" />
        <span className="ml-2 text-[11px] text-foreground-muted">{label}</span>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  );
}

export function InterfaceShowcase() {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      <MockFrame label="Tableau de bord" className="md:col-span-2">
        <div className="flex items-center justify-between rounded-xl border border-border-subtle bg-white/[0.02] px-4 py-3">
          <span className="text-xs text-foreground-muted">Plan Pro</span>
          <span className="text-xs font-medium text-foreground">2/3 formations générées</span>
        </div>
        <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
          {[
            { title: "Créer sa boutique en ligne", pct: 100 },
            { title: "Comprendre les marchés financiers", pct: 62 },
            { title: "La Révolution française", pct: 18 },
          ].map((course) => (
            <div
              key={course.title}
              className="rounded-xl border border-border-subtle bg-white/[0.02] p-3"
            >
              <p className="truncate text-xs font-medium text-foreground">{course.title}</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-accent-blue to-accent-violet"
                  style={{ width: `${course.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </MockFrame>

      <MockFrame label="Générateur">
        <p className="text-sm text-foreground-muted">Que veux-tu apprendre ?</p>
        <p className="typing-caret mt-2 text-base text-foreground">
          Les bases de l&apos;investissement
        </p>
        <div className="mt-4 flex justify-end">
          <span className="rounded-full bg-gradient-to-r from-accent-blue to-accent-violet px-4 py-2 text-xs font-semibold text-white">
            Générer ma formation
          </span>
        </div>
      </MockFrame>

      <MockFrame label="Formation">
        <span className="text-[11px] font-mono text-accent-violet-light">Chapitre 2</span>
        <p className="mt-1 text-sm font-semibold text-foreground">La diversification du portefeuille</p>
        <div className="mt-2 rounded-lg border border-accent-violet/25 bg-accent-violet/[0.08] p-2.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-accent-violet-light">
            À retenir
          </span>
          <p className="mt-1 text-xs text-foreground-muted">
            Ne jamais tout miser sur un seul actif ou secteur.
          </p>
        </div>
      </MockFrame>

      <MockFrame label="Chat avec Tavyra">
        <div className="space-y-2">
          <div className="ml-auto max-w-[80%] rounded-xl rounded-tr-sm bg-white/[0.06] px-3 py-2 text-xs text-foreground">
            C&apos;est quoi un ETF concrètement ?
          </div>
          <div className="max-w-[85%] rounded-xl rounded-tl-sm bg-accent-violet/10 px-3 py-2 text-xs text-foreground">
            Un panier d&apos;actifs que tu achètes en une seule fois, comme un
            mini-portefeuille déjà diversifié.
          </div>
        </div>
      </MockFrame>

      <MockFrame label="Quiz">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent-violet-light">
          Question 4/10
        </p>
        <p className="mt-1.5 text-sm text-foreground">
          Que signifie « diversifier » un portefeuille ?
        </p>
        <div className="mt-2.5 space-y-1.5 text-xs">
          <div className="rounded-lg border border-accent-violet/40 bg-accent-violet/15 px-2.5 py-1.5 text-accent-violet-light">
            Répartir ses investissements ✓
          </div>
          <div className="rounded-lg border border-border-subtle bg-white/[0.02] px-2.5 py-1.5 text-foreground-muted">
            Investir dans une seule action
          </div>
        </div>
      </MockFrame>
    </div>
  );
}
