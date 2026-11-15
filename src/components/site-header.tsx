const NAV_LINKS = [
  { label: "Comment ça marche", href: "#comment-ca-marche" },
  { label: "Tarifs", href: "/pricing" },
];

export function SiteHeader() {
  return (
    <header className="relative z-10 w-full">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <a href="#" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent-blue to-accent-violet text-sm font-semibold text-white shadow-[0_0_24px_-4px_var(--accent-violet)]">
            L
          </span>
          <span className="text-lg font-semibold tracking-tight">Lia</span>
        </a>

        <nav className="hidden items-center gap-8 text-sm text-foreground-muted md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <a
            href="/login"
            className="hidden text-sm text-foreground-muted transition-colors hover:text-foreground sm:block"
          >
            Connexion
          </a>
          <a
            href="#generer"
            className="rounded-full border border-border-subtle bg-white/5 px-4 py-2 text-sm font-medium text-foreground backdrop-blur transition-colors hover:bg-white/10"
          >
            Essayer gratuitement
          </a>
        </div>
      </div>
    </header>
  );
}
