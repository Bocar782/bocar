"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BrandMark } from "./brand-mark";
import { useActiveSection } from "./marketing/use-active-section";

const NAV_LINKS = [
  { label: "Fonctionnalités", href: "/#fonctionnalites", id: "fonctionnalites" },
  { label: "Tarifs", href: "/pricing", id: null },
  { label: "Pourquoi nous", href: "/pourquoi-nous", id: null },
];

const SECTION_IDS = NAV_LINKS.map((link) => link.id).filter((id): id is string => id !== null);

export function SiteHeader({ variant = "dark" }: { variant?: "dark" | "light" }) {
  const isLight = variant === "light";
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const activeSection = useActiveSection(SECTION_IDS);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 24);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-20 w-full transition-colors duration-300 ${
        scrolled
          ? "border-b border-border-subtle bg-background/80 backdrop-blur-xl"
          : "border-b border-transparent"
      }`}
    >
      <div
        className={`mx-auto flex max-w-6xl items-center justify-between px-6 ${
          isLight ? "h-16" : "py-5"
        }`}
      >
        <Link href="/" className="flex items-center gap-2">
          <BrandMark size={32} />
          <span className="text-lg font-semibold tracking-tight">Tavyra</span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm text-foreground-muted lg:flex xl:gap-8">
          {NAV_LINKS.map((link) =>
            // Prompt 05.30 : "Tarifs" mis en avant (pastille dégradée) sur la
            // landing — retour utilisateur "je ne vois pas les tarifs" depuis
            // l'accueil, /pricing reste la page dédiée (pas dupliquée ici).
            isLight && link.label === "Tarifs" ? (
              <a
                key={link.href}
                href={link.href}
                className="rounded-full bg-gradient-to-r from-[#8b5cf6] to-accent-violet px-3.5 py-1.5 text-sm font-medium text-white shadow-[0_4px_16px_-6px_rgba(147,51,234,0.6)] transition-all hover:brightness-110"
              >
                {link.label}
              </a>
            ) : (
              <a
                key={link.href}
                href={link.href}
                className={`transition-colors hover:text-foreground ${
                  link.id && activeSection === link.id ? "text-foreground" : ""
                }`}
              >
                {link.label}
              </a>
            ),
          )}
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
            className={
              isLight
                ? "rounded-lg bg-gradient-to-r from-[#8b5cf6] to-accent-violet px-4 py-2 text-sm font-medium text-white shadow-[0_4px_16px_-6px_rgba(147,51,234,0.6)] transition-all hover:brightness-110"
                : "rounded-full border border-border-subtle bg-white/5 px-4 py-2 text-sm font-medium text-foreground backdrop-blur transition-colors hover:bg-white/10"
            }
          >
            Essayer gratuitement
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Menu"
          aria-expanded={open}
          className={
            isLight
              ? "flex h-9 w-9 items-center justify-center rounded-lg border border-border-subtle text-foreground lg:hidden"
              : "flex h-10 w-10 items-center justify-center rounded-full border border-border-subtle bg-white/5 text-foreground lg:hidden"
          }
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
            {NAV_LINKS.map((link) =>
              isLight && link.label === "Tarifs" ? (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="rounded-lg bg-gradient-to-r from-[#8b5cf6] to-accent-violet px-3 py-2.5 text-sm font-medium text-white"
                >
                  {link.label}
                </a>
              ) : (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={`rounded-lg px-3 py-2.5 text-sm text-foreground-muted transition-colors hover:text-foreground ${
                    isLight ? "hover:bg-background-elevated" : "hover:bg-white/5"
                  }`}
                >
                  {link.label}
                </a>
              ),
            )}
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className={`rounded-lg px-3 py-2.5 text-sm text-foreground-muted transition-colors hover:text-foreground ${
                isLight ? "hover:bg-background-elevated" : "hover:bg-white/5"
              }`}
            >
              Connexion
            </Link>
            <Link
              href="/signup"
              onClick={() => setOpen(false)}
              className={
                isLight
                  ? "mt-2 rounded-lg bg-gradient-to-r from-[#8b5cf6] to-accent-violet px-4 py-2.5 text-center text-sm font-semibold text-white"
                  : "mt-2 rounded-full bg-gradient-to-r from-accent-blue to-accent-violet px-4 py-2.5 text-center text-sm font-semibold text-white"
              }
            >
              Essayer gratuitement
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
