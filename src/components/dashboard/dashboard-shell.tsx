"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { BrandMark } from "@/components/brand-mark";
import { Badge } from "@/components/ui/badge";
import { IconClose, IconLogout, IconMenu } from "./icons";
import { SidebarNav } from "./sidebar-nav";
import { useAppTheme } from "./theme-context";
import { TopbarSearch } from "./topbar-search";

function SidebarFooter({
  userEmail,
  initials,
  isPro,
  onSignOut,
}: {
  userEmail: string;
  initials: string;
  isPro: boolean;
  onSignOut: () => void | Promise<void>;
}) {
  return (
    <div className="mt-4 space-y-3">
      {!isPro && (
        <Link
          href="/checkout"
          className="gradient-border group relative block overflow-hidden rounded-2xl bg-accent-violet/[0.1] p-4 transition-colors hover:bg-accent-violet/[0.16]"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-accent-violet/40 blur-2xl"
          />
          <p className="relative text-sm font-semibold text-foreground">Passe au plan Pro</p>
          <p className="relative mt-1 text-xs leading-relaxed text-foreground-muted">
            Débloque les formations complètes et le chat avec Tavyra.
          </p>
          <span className="relative mt-3 inline-flex items-center gap-1 text-xs font-semibold text-accent-violet-light transition-transform group-hover:translate-x-0.5">
            Passer au Pro →
          </span>
        </Link>
      )}
      <div className="flex items-center gap-3 rounded-2xl border border-border-subtle bg-overlay/[0.03] p-2.5">
        <span className="bg-brand flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white">
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-foreground">{userEmail}</p>
          <Badge tone={isPro ? "accent" : "neutral"} className="mt-1 px-2 py-0.5 text-[10px]">
            {isPro ? "Plan Pro" : "Plan gratuit"}
          </Badge>
        </div>
        <form action={onSignOut}>
          <button
            type="submit"
            aria-label="Se déconnecter"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-foreground-muted transition-colors hover:bg-overlay/[0.08] hover:text-foreground"
          >
            <IconLogout width={16} height={16} />
          </button>
        </form>
      </div>
    </div>
  );
}

// Prompt 06.1 : shell commun à toutes les pages "app" de l'intérieur
// (tableau de bord, bibliothèque, création, profil) — sidebar fixe en
// desktop, tiroir plein écran en mobile. Les pages de lecture
// (formations/[id], analyses/[id]) gardent volontairement leur propre
// en-tête immersif et n'utilisent PAS ce composant.
export function DashboardShell({
  userEmail,
  isPro,
  onSignOut,
  children,
}: {
  userEmail: string;
  isPro: boolean;
  onSignOut: () => void | Promise<void>;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const initials = userEmail.trim().slice(0, 1).toUpperCase() || "?";

  // Prompt 06.7 : thème clair/sombre de l'intérieur de l'app (jamais la
  // landing, qui garde son propre habillage) — voir theme-context.tsx.
  const { theme } = useAppTheme();

  return (
    // bg-background (et pas seulement les cartes individuelles) : la balise
    // <body> reste hors de la portée de data-theme (elle l'englobe, un
    // attribut ne remonte jamais vers le haut) et garde le fond du thème
    // sombre par défaut — sans ce fond explicite ici, les surfaces semi-
    // transparentes de l'intérieur de l'app (Card par défaut, overlays...)
    // resteraient visuellement sombres même en thème clair.
    <div data-theme={theme} className="relative flex min-h-screen w-full bg-background text-foreground">
      {/* Sidebar desktop */}
      <aside className="sticky top-0 z-20 hidden h-screen w-64 shrink-0 flex-col border-r border-border-subtle bg-background-elevated/70 px-4 py-6 backdrop-blur-xl lg:flex">
        <Link href="/dashboard" className="flex items-center gap-2 px-2">
          <BrandMark size={28} />
          <span className="text-base font-semibold tracking-tight">Tavyra</span>
        </Link>

        <div className="mt-8 flex-1 overflow-y-auto">
          <SidebarNav />
        </div>

        <SidebarFooter userEmail={userEmail} initials={initials} isPro={isPro} onSignOut={onSignOut} />
      </aside>

      {/* Colonne principale : topbar + tiroir en mobile uniquement, un seul
          <main> pour les deux tailles d'écran (sinon `children` serait monté
          deux fois — doublerait tout état/effet des composants enfants). */}
      <div className="relative flex min-h-screen w-full min-w-0 flex-1 flex-col">
        <div aria-hidden className="app-ambient" />
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border-subtle bg-background/90 px-4 py-3.5 backdrop-blur-xl lg:hidden">
          <Link href="/dashboard" className="flex items-center gap-2">
            <BrandMark size={26} />
            <span className="text-base font-semibold tracking-tight">Tavyra</span>
          </Link>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Ouvrir le menu"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border-subtle bg-overlay/5 text-foreground"
          >
            <IconMenu width={18} height={18} />
          </button>
        </header>

        {open && (
          <div className="fixed inset-0 z-40 flex lg:hidden">
            <div
              aria-hidden
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            <div className="rise relative z-10 flex h-full w-72 max-w-[85vw] flex-col border-r border-border-subtle bg-background-elevated px-4 py-5 shadow-2xl">
              <div className="flex items-center justify-between px-2">
                <Link href="/dashboard" className="flex items-center gap-2" onClick={() => setOpen(false)}>
                  <BrandMark size={26} />
                  <span className="text-base font-semibold tracking-tight">Tavyra</span>
                </Link>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Fermer le menu"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground-muted hover:bg-overlay/[0.06] hover:text-foreground"
                >
                  <IconClose width={16} height={16} />
                </button>
              </div>

              <div className="mt-6 flex-1 overflow-y-auto">
                <SidebarNav onNavigate={() => setOpen(false)} />
              </div>

              <SidebarFooter
                userEmail={userEmail}
                initials={initials}
                isPro={isPro}
                onSignOut={onSignOut}
              />
            </div>
          </div>
        )}

        {/* Barre desktop : recherche globale + avatar — n'existe qu'à partir
            de lg (sur mobile, la recherche vit directement dans la page
            Bibliothèque, déjà accessible depuis le tiroir). */}
        <header className="sticky top-0 z-20 hidden items-center justify-between gap-4 border-b border-border-subtle bg-background/60 px-8 py-4 backdrop-blur-xl backdrop-saturate-150 lg:flex xl:px-12">
          <TopbarSearch />
          <Link
            href="/dashboard/profil"
            aria-label="Profil"
            className="bg-brand flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white shadow-[0_6px_16px_-6px_var(--glow)] ring-2 ring-background transition-transform hover:scale-105"
          >
            {initials}
          </Link>
        </header>

        <main className="page-enter relative z-10 flex-1 px-4 pb-16 pt-6 sm:px-6 lg:px-8 lg:pb-12 lg:pt-8 xl:px-12">
          {children}
        </main>
      </div>
    </div>
  );
}
