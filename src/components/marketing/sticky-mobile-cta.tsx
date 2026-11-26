"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// Prompt 06.13 : barre d'action persistante en bas d'écran, mobile
// uniquement, pour réduire la friction d'inscription une fois que le
// visiteur a quitté le hero (où le CTA est déjà visible) — masquée tant
// qu'on est dans le hero pour ne jamais dupliquer un CTA déjà à l'écran,
// et masquée à nouveau tout en bas de page où se trouve le CTA final.
export function StickyMobileCta() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function handleScroll() {
      const scrollY = window.scrollY;
      const pastHero = scrollY > window.innerHeight * 0.7;
      const nearBottom =
        scrollY + window.innerHeight > document.documentElement.scrollHeight - 400;
      setVisible(pastHero && !nearBottom);
    }
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div
      aria-hidden={!visible}
      className={`fixed inset-x-0 bottom-0 z-30 border-t border-border-subtle bg-background-card/95 px-4 py-3 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.25)] backdrop-blur-sm transition-transform duration-300 sm:hidden ${
        visible ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <Link
        href="/signup"
        className="btn-brand flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white"
      >
        Essayer gratuitement →
      </Link>
    </div>
  );
}
