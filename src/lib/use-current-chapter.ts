"use client";

import { useEffect, useState } from "react";

/**
 * Repère le chapitre (`[data-chapter-index]`) actuellement visible dans une
 * bande proche du haut de l'écran — pattern classique de "scrollspy".
 *
 * `maxIndex`, s'il est fourni, plafonne la valeur retournée (utile pour une
 * formation verrouillée : on ne veut pas faire avancer la progression ou le
 * contexte du chat au-delà du contenu réellement débloqué, même si le
 * contenu flouté reste visuellement présent dans la page).
 */
export function useCurrentChapterIndex(maxIndex?: number): number {
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

  return maxIndex !== undefined
    ? Math.min(currentChapterIndex, maxIndex)
    : currentChapterIndex;
}
