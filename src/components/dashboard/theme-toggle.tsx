"use client";

import { useAppTheme, type AppTheme } from "./theme-context";

const THEMES: { value: AppTheme; label: string; swatch: string }[] = [
  { value: "dark", label: "Violet", swatch: "bg-[#2b1a4d]" },
  { value: "noir", label: "Noir", swatch: "bg-[#0a0a0a]" },
  { value: "light", label: "Blanc", swatch: "bg-white" },
];

// Choix du thème (section « Thème » du profil). Même store que
// DashboardShell et la landing : le changement s'applique immédiatement.
export function ThemeToggle() {
  const { theme, setTheme } = useAppTheme();

  return (
    <div className="inline-flex rounded-full border border-border-subtle bg-overlay/[0.02] p-1 text-sm">
      {THEMES.map((t) => (
        <button
          key={t.value}
          type="button"
          onClick={() => setTheme(t.value)}
          aria-pressed={theme === t.value}
          className={`flex items-center gap-2 rounded-full px-4 py-2 font-medium transition-colors ${
            theme === t.value
              ? "bg-gradient-to-r from-brand-from via-brand-via to-brand-to text-white"
              : "text-foreground-muted hover:text-foreground"
          }`}
        >
          <span className={`h-3 w-3 rounded-full border border-white/30 ${t.swatch}`} />
          {t.label}
        </button>
      ))}
    </div>
  );
}

// Version discrète : trois pastilles, sans texte (pied de page, barre latérale).
export function ThemeDots({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useAppTheme();
  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`} role="group" aria-label="Thème">
      {THEMES.map((t) => (
        <button
          key={t.value}
          type="button"
          onClick={() => setTheme(t.value)}
          aria-pressed={theme === t.value}
          aria-label={`Thème ${t.label}`}
          title={`Thème ${t.label}`}
          className={`h-3.5 w-3.5 rounded-full border transition-transform hover:scale-125 ${t.swatch} ${
            theme === t.value ? "border-accent-violet-light ring-2 ring-accent-violet/50" : "border-border-subtle opacity-70"
          }`}
        />
      ))}
    </div>
  );
}

// Applique le thème choisi à une zone de page (utilisé par la landing).
export function ThemeScope({ className = "", children }: { className?: string; children: React.ReactNode }) {
  const { theme } = useAppTheme();
  return (
    <div data-theme={theme} className={className}>
      {children}
    </div>
  );
}
