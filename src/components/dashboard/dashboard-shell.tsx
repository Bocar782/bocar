"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { BrandMark } from "@/components/brand-mark";
import { Badge } from "@/components/ui/badge";
import { IconClose, IconLogout, IconMenu } from "./icons";
import { SidebarNav } from "./sidebar-nav";
import { TopbarSearch } from "./topbar-search";

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

  return (
    <div className="relative flex min-h-screen w-full">
      {/* Sidebar desktop */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border-subtle bg-background-elevated/60 px-4 py-6 lg:flex">
        <Link href="/dashboard" className="flex items-center gap-2 px-2">
          <BrandMark size={28} />
          <span className="text-base font-semibold tracking-tight">Tavyra</span>
        </Link>

        <div className="mt-8 flex-1 overflow-y-auto">
          <SidebarNav />
        </div>

        <div className="mt-4 border-t border-border-subtle pt-4">
          <div className="flex items-center justify-between gap-2 px-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-foreground">{userEmail}</p>
              <Badge tone={isPro ? "accent" : "neutral"} className="mt-1">
                {isPro ? "Plan Pro" : "Plan gratuit"}
              </Badge>
            </div>
            <form action={onSignOut}>
              <button
                type="submit"
                aria-label="Se déconnecter"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-foreground-muted transition-colors hover:bg-white/[0.06] hover:text-foreground"
              >
                <IconLogout width={16} height={16} />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Colonne principale : topbar + tiroir en mobile uniquement, un seul
          <main> pour les deux tailles d'écran (sinon `children` serait monté
          deux fois — doublerait tout état/effet des composants enfants). */}
      <div className="flex min-h-screen w-full flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border-subtle bg-background/90 px-4 py-3.5 backdrop-blur-xl lg:hidden">
          <Link href="/dashboard" className="flex items-center gap-2">
            <BrandMark size={26} />
            <span className="text-base font-semibold tracking-tight">Tavyra</span>
          </Link>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Ouvrir le menu"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border-subtle bg-white/5 text-foreground"
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
            <div className="relative z-10 flex h-full w-72 max-w-[85vw] flex-col bg-background-elevated px-4 py-5">
              <div className="flex items-center justify-between px-2">
                <Link href="/dashboard" className="flex items-center gap-2" onClick={() => setOpen(false)}>
                  <BrandMark size={26} />
                  <span className="text-base font-semibold tracking-tight">Tavyra</span>
                </Link>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Fermer le menu"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground-muted hover:bg-white/[0.06] hover:text-foreground"
                >
                  <IconClose width={16} height={16} />
                </button>
              </div>

              <div className="mt-6 flex-1 overflow-y-auto">
                <SidebarNav onNavigate={() => setOpen(false)} />
              </div>

              <div className="border-t border-border-subtle pt-4">
                <div className="flex items-center justify-between gap-2 px-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-foreground">{userEmail}</p>
                    <Badge tone={isPro ? "accent" : "neutral"} className="mt-1">
                      {isPro ? "Plan Pro" : "Plan gratuit"}
                    </Badge>
                  </div>
                  <form action={onSignOut}>
                    <button
                      type="submit"
                      aria-label="Se déconnecter"
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-foreground-muted transition-colors hover:bg-white/[0.06] hover:text-foreground"
                    >
                      <IconLogout width={16} height={16} />
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Barre desktop : recherche globale + avatar — n'existe qu'à partir
            de lg (sur mobile, la recherche vit directement dans la page
            Bibliothèque, déjà accessible depuis le tiroir). */}
        <header className="sticky top-0 z-20 hidden items-center justify-between gap-4 border-b border-border-subtle bg-background/80 px-8 py-4 backdrop-blur-xl lg:flex xl:px-12">
          <TopbarSearch />
          <Link
            href="/dashboard/profil"
            aria-label="Profil"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent-blue to-accent-violet text-sm font-semibold text-white"
          >
            {initials}
          </Link>
        </header>

        <main className="relative z-10 flex-1 px-4 pb-16 pt-6 sm:px-6 lg:px-8 lg:pb-12 lg:pt-8 xl:px-12">
          {children}
        </main>
      </div>
    </div>
  );
}
