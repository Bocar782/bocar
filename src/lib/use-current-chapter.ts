"use client";

import { useEffect, useState } from "react";

/**
 * Repère le chapitre (`[data-chapter-index]`) actuellement visible dans une
 * bande proche du haut de l'écran — pattern classique de "scrollspy".
 */
export function useCurrentChapterIndex(): number {
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);

  useEffect(() => {
    const elements = Array.from(
      document.querySelectorAll<HTMLElement>("[data-chapter-index]"),
    );
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting);
        if (visible.length > 0) {
          const index = Number(visible[0].target.getAttribute("data-chapter-index"));
          setCurrentChapterIndex(index);
        }
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 },
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return currentChapterIndex;
}
