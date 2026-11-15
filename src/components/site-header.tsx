"use client";

import { useState } from "react";
import Link from "next/link";

const NAV_LINKS = [
  { label: "Comment ça marche", href: "/#comment-ca-marche" },
  { label: "Fonctionnalités", href: "/#avantages" },
  { label: "Tarifs", href: "/#tarifs" },
  { label: "Pourquoi nous", href: "/pourquoi-nous" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="relative z-20 w-full">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent-blue to-accent-violet text-sm font-semibold text-white shadow-[0_0_24px_-4px_var(--accent-violet)]">
            L
          </span>
          <span className="text-lg font-semibold tracking-tight">Lia</span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-foreground-muted lg:flex xl:gap-8">
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

        <div className="hidden items-center gap-3 lg:flex">
          <Link
            href="/login"
            className="text-sm text-foreground-muted transition-colors hover:text-foreground"
          >
            Connexion
          </Link>
          <Link
            href="/signup"
            className="rounded-full border border-border-subtle bg-white/5 px-4 py-2 text-sm font-medium text-foreground backdrop-blur transition-colors hover:bg-white/10"
          >
            Essayer gratuitement
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Menu"
          aria-expanded={open}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border-subtle bg-white/5 text-foreground lg:hidden"
        >
          <svg aria-hidden width="18" height="18" viewBox="0 0 18 18" fill="none">
            {open ? (
              <path
                d="M4 4l10 10M14 4 4 14"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            ) : (
              <path
                d="M2 5h14M2 9h14M2 13h14"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            )}
          </svg>
        </button>
      </div>

      {open && (
        <div className="border-t border-border-subtle bg-background/95 px-6 py-4 backdrop-blur-xl lg:hidden">
          <nav className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm text-foreground-muted transition-colors hover:bg-white/5 hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2.5 text-sm text-foreground-muted transition-colors hover:bg-white/5 hover:text-foreground"
            >
              Connexion
            </Link>
            <Link
              href="/signup"
              onClick={() => setOpen(false)}
              className="mt-2 rounded-full bg-gradient-to-r from-accent-blue to-accent-violet px-4 py-2.5 text-center text-sm font-semibold text-white"
            >
              Essayer gratuitement
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
