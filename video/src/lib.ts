import { Easing, interpolate } from "remotion";

export const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);
export const easeIn = Easing.bezier(0.7, 0, 0.84, 0);
export const easeOutBack = Easing.bezier(0.34, 1.45, 0.64, 1);

/** Interpolation bornée avec easing (par défaut easeOut). */
export function tw(
  frame: number,
  [a, b]: [number, number],
  [from, to]: [number, number],
  easing: (t: number) => number = easeOut,
) {
  return interpolate(frame, [a, b], [from, to], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing,
  });
}

/** Pseudo-aléatoire déterministe. */
export function rand(seed: number) {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** Bruit doux déterministe (somme de sinus) pour les dérives de caméra. */
export function drift(frame: number, seed: number, amp = 1) {
  return (
    amp *
    (Math.sin(frame * 0.031 + seed) * 0.6 + Math.sin(frame * 0.017 + seed * 2.3) * 0.4)
  );
}

/** Texte tapé : nombre de caractères visibles à un instant donné. */
export function typed(text: string, frame: number, start: number, end: number) {
  const n = Math.round(tw(frame, [start, end], [0, text.length], (t) => t));
  return text.slice(0, n);
}
