"use client";

import { useEffect, useState, type ReactNode } from "react";

// Mode concentration : la formation occupe toute la page, sans en-tête ni
// éléments autour. Bouton pour entrer en haut de la formation, bouton (et
// touche Échap) pour sortir.
export function FocusReader({ children }: { children: ReactNode }) {
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFocused(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [focused]);

  return (
    <div className={focused ? "focus-mode" : "w-full"}>
      <div className={focused ? "mx-auto w-full max-w-4xl px-5 pb-24 pt-6 sm:px-8" : "w-full"}>
        <div className="mb-4 flex justify-end">
          {focused ? (
            <button
              type="button"
              onClick={() => setFocused(false)}
              className="sticky top-4 z-10 inline-flex items-center gap-2 rounded-full border border-border-subtle bg-background-card/90 px-4 py-2 text-sm font-medium text-foreground shadow-lg backdrop-blur transition-colors hover:border-accent-violet/50"
            >
              <svg aria-hidden width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M6 2v4H2M10 2v4h4M6 14v-4H2M10 14v-4h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Quitter le mode concentration
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setFocused(true)}
              className="inline-flex items-center gap-2 rounded-full border border-border-subtle bg-overlay/[0.03] px-4 py-2 text-sm font-medium text-foreground-muted transition-colors hover:border-accent-violet/50 hover:text-foreground"
            >
              <svg aria-hidden width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Mode concentration
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
