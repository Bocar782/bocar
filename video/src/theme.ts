// Tokens repris tels quels de src/app/globals.css (identité réelle de Tavyra).
export const C = {
  bg: "#06070f",
  bgElevated: "#0b0d1c",
  fg: "#f4f4fb",
  muted: "#9797ad",
  border: "rgba(255, 255, 255, 0.08)",
  violet: "#8b5cf6",
  violetLight: "#c4b5fd",
  blue: "#4c7cf3",
  blueLight: "#7fa6ff",
  success: "#10b981",
  successLight: "#6ee7b7",
};

export const GRADIENT = `linear-gradient(to right, ${C.blue}, ${C.violet})`;
export const GRADIENT_BR = `linear-gradient(135deg, ${C.blue}, ${C.violet})`;
export const TEXT_GRADIENT = `linear-gradient(100deg, ${C.blueLight} 0%, ${C.violetLight} 55%, ${C.violet} 100%)`;

export const FONT = "Geist, system-ui, sans-serif";
export const MONO = "'Geist Mono', ui-monospace, monospace";

/** Facteur d'agrandissement de l'UI produit (px CSS de l'app -> px vidéo). */
export const UI_ZOOM = 2.3;
