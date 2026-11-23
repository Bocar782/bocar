"use client";

import { IconMoon, IconSun } from "./icons";
import { useAppTheme } from "./theme-context";

// Prompt 06.7 : bascule clair/sombre utilisée dans la section "Thème" du
// profil — lit/écrit le même store externe que DashboardShell (voir
// theme-context.tsx), donc le changement s'applique immédiatement, sans
// recharger la page.
export function ThemeToggle() {
  const { theme, setTheme } = useAppTheme();

  return (
    <div className="inline-flex rounded-full border border-border-subtle bg-overlay/[0.02] p-1 text-sm">
      <button
        type="button"
        onClick={() => setTheme("dark")}
        aria-pressed={theme === "dark"}
        className={`flex items-center gap-2 rounded-full px-4 py-2 font-medium transition-colors ${
          theme === "dark"
            ? "bg-gradient-to-r from-accent-blue to-accent-violet text-white"
            : "text-foreground-muted hover:text-foreground"
        }`}
      >
        <IconMoon width={16} height={16} />
        Sombre
      </button>
      <button
        type="button"
        onClick={() => setTheme("light")}
        aria-pressed={theme === "light"}
        className={`flex items-center gap-2 rounded-full px-4 py-2 font-medium transition-colors ${
          theme === "light"
            ? "bg-gradient-to-r from-accent-blue to-accent-violet text-white"
            : "text-foreground-muted hover:text-foreground"
        }`}
      >
        <IconSun width={16} height={16} />
        Clair
      </button>
    </div>
  );
}
