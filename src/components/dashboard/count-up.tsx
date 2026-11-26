"use client";

import { useEffect, useState } from "react";

const DURATION_MS = 1100;

/**
 * Fait défiler les nombres contenus dans `value` de 0 jusqu'à leur valeur
 * réelle au montage (ex. "78%", "2 h 22", "5 j"). La valeur finale affichée
 * est toujours exactement `value` — seul le chemin pour y arriver est animé.
 */
export function CountUp({ value }: { value: string }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = reduced ? 1 : Math.min(1, (now - start) / DURATION_MS);
      setProgress(1 - Math.pow(1 - t, 3));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const display =
    progress >= 1 ? value : value.replace(/\d+/g, (n) => String(Math.round(Number(n) * progress)));

  return (
    <>
      <span className="sr-only">{value}</span>
      <span aria-hidden>{display}</span>
    </>
  );
}
