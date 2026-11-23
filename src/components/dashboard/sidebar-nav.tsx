"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconChat } from "@/components/marketing/icons";
import { IconHome, IconLibrary, IconPlusCircle, IconUser } from "./icons";
import type { ComponentType, SVGProps } from "react";

type NavItem = {
  label: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
};

// Prompt 06.1 : nav interne partagée par toutes les pages "app" (tableau de
// bord, bibliothèque, création, assistant, profil) — la lecture de
// formation/d'analyse (/dashboard/formations/[id], /dashboard/analyses/[id])
// reste volontairement hors de ce shell : expérience de lecture immersive,
// pas de sidebar.
export const NAV_ITEMS: NavItem[] = [
  { label: "Tableau de bord", href: "/dashboard", icon: IconHome },
  { label: "Bibliothèque", href: "/dashboard/formations", icon: IconLibrary },
  { label: "Créer une formation", href: "/dashboard/creer", icon: IconPlusCircle },
  { label: "Assistant", href: "/dashboard/assistant", icon: IconChat },
  { label: "Profil", href: "/dashboard/profil", icon: IconUser },
];

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors ${
              active
                ? "bg-gradient-to-r from-accent-blue/15 to-accent-violet/15 text-foreground"
                : "text-foreground-muted hover:bg-overlay/[0.04] hover:text-foreground"
            }`}
          >
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                active ? "bg-accent-violet/20 text-accent-violet-light" : "text-foreground-muted"
              }`}
            >
              <Icon width={18} height={18} />
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
