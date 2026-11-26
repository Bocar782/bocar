import React from "react";
import { C, FONT, GRADIENT, GRADIENT_BR, MONO } from "../theme";

// Reproductions fidèles des composants réels (src/components/ui/*.tsx et
// composants produit) — mêmes rayons, bordures, teintes et typographies,
// exprimés en px CSS de l'app. L'agrandissement se fait via `zoom` sur le
// conteneur (rendu net, pas d'upscale bitmap).

export const UiRoot: React.FC<{ zoom: number; width: number; style?: React.CSSProperties; children: React.ReactNode }> = ({
  zoom,
  width,
  style,
  children,
}) => (
  <div style={{ zoom, width, fontFamily: FONT, color: C.fg, WebkitFontSmoothing: "antialiased", ...style }}>
    {children}
  </div>
);

/** Card variant="elevated" : bordure dégradée bleu -> violet, fond élevé. */
export const ElevatedCard: React.FC<{ children: React.ReactNode; padding?: number; style?: React.CSSProperties }> = ({
  children,
  padding = 24,
  style,
}) => (
  <div style={{ position: "relative", borderRadius: 28, padding: 1, ...style }}>
    <div
      style={{
        position: "absolute",
        inset: 0,
        borderRadius: 28,
        background: `linear-gradient(to bottom right, rgba(76,124,243,0.4), rgba(255,255,255,0.1), rgba(139,92,246,0.4))`,
      }}
    />
    <div style={{ position: "relative", borderRadius: 28, background: "rgba(11,13,28,0.94)", padding }}>{children}</div>
  </div>
);

/** Card variant="panel". */
export const PanelCard: React.FC<{ children: React.ReactNode; padding?: number; style?: React.CSSProperties }> = ({
  children,
  padding = 24,
  style,
}) => (
  <div
    style={{
      borderRadius: 28,
      border: `1px solid ${C.border}`,
      background: "rgba(11,13,28,0.92)",
      padding,
      ...style,
    }}
  >
    {children}
  </div>
);

/** Card variant="default". */
export const DefaultCard: React.FC<{ children: React.ReactNode; padding?: number; style?: React.CSSProperties }> = ({
  children,
  padding = 24,
  style,
}) => (
  <div
    style={{
      borderRadius: 16,
      border: `1px solid ${C.border}`,
      background: "rgba(13,15,30,0.92)",
      padding,
      ...style,
    }}
  >
    {children}
  </div>
);

/** Card variant="accent-violet" ("À retenir", correction…). */
export const AccentViolet: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div
    style={{
      borderRadius: 12,
      border: "1px solid rgba(139,92,246,0.25)",
      background: "rgba(139,92,246,0.08)",
      padding: 16,
      ...style,
    }}
  >
    {children}
  </div>
);

/** Card variant="accent-blue" ("Exemple concret", "Exercice pratique"). */
export const AccentBlue: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div
    style={{
      borderRadius: 12,
      border: `1px solid ${C.border}`,
      borderLeft: "4px solid rgba(76,124,243,0.5)",
      background: "rgba(255,255,255,0.03)",
      padding: 16,
      ...style,
    }}
  >
    {children}
  </div>
);

export const Eyebrow: React.FC<{ children: React.ReactNode; color?: string; style?: React.CSSProperties }> = ({
  children,
  color = C.violetLight,
  style,
}) => (
  <span
    style={{
      fontSize: 12,
      fontWeight: 600,
      textTransform: "uppercase",
      letterSpacing: "0.025em",
      color,
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      ...style,
    }}
  >
    {children}
  </span>
);

export const PrimaryButton: React.FC<{
  children: React.ReactNode;
  press?: number;
  disabled?: boolean;
  size?: "sm" | "md";
  style?: React.CSSProperties;
}> = ({ children, press = 0, disabled, size = "md", style }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      borderRadius: 9999,
      background: GRADIENT,
      color: "white",
      fontWeight: 600,
      fontSize: size === "md" ? 14 : 12,
      padding: size === "md" ? "10px 24px" : "8px 16px",
      boxShadow: "0 8px 30px -8px #8b5cf6",
      opacity: disabled ? 0.4 : 1,
      transform: `scale(${1 - press * 0.06})`,
      filter: press > 0 ? `brightness(${1 + press * 0.25})` : undefined,
      whiteSpace: "nowrap",
      ...style,
    }}
  >
    {children}
  </span>
);

export const SecondaryButton: React.FC<{ children: React.ReactNode; press?: number; style?: React.CSSProperties }> = ({
  children,
  press = 0,
  style,
}) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      borderRadius: 9999,
      border: `1px solid ${press > 0 ? "rgba(255,255,255,0.2)" : C.border}`,
      background: press > 0 ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)",
      padding: "6px 12px",
      fontSize: 12,
      fontWeight: 500,
      color: press > 0 ? C.fg : C.muted,
      transform: `scale(${1 - press * 0.06})`,
      ...style,
    }}
  >
    {children}
  </span>
);

export const Badge: React.FC<{ tone: "neutral" | "info" | "success" | "accent"; children: React.ReactNode }> = ({
  tone,
  children,
}) => {
  const tones = {
    neutral: { background: "rgba(255,255,255,0.06)", color: C.muted },
    info: { background: "rgba(76,124,243,0.15)", color: C.blueLight },
    success: { background: "rgba(16,185,129,0.15)", color: C.successLight },
    accent: { background: "rgba(139,92,246,0.15)", color: C.violetLight },
  };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: 9999,
        padding: "4px 10px",
        fontSize: 12,
        fontWeight: 500,
        ...tones[tone],
      }}
    >
      {children}
    </span>
  );
};

export const ProgressBar: React.FC<{ percent: number; height?: number; style?: React.CSSProperties }> = ({
  percent,
  height = 6,
  style,
}) => (
  <div style={{ height, borderRadius: 9999, background: "rgba(255,255,255,0.06)", overflow: "hidden", ...style }}>
    <div style={{ height: "100%", width: `${percent}%`, borderRadius: 9999, background: GRADIENT }} />
  </div>
);

export const CheckDot: React.FC<{ size?: number; scale?: number }> = ({ size = 14, scale = 1 }) => (
  <svg width={size} height={size} viewBox="0 0 14 14" fill="none" style={{ transform: `scale(${scale})` }}>
    <circle cx="7" cy="7" r="7" fill={C.blue} />
    <path d="M4 7l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const GradientDot: React.FC<{ size: number; children?: React.ReactNode; style?: React.CSSProperties }> = ({
  size,
  children,
  style,
}) => (
  <span
    style={{
      width: size,
      height: size,
      borderRadius: 9999,
      background: GRADIENT_BR,
      color: "white",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: size * 0.42,
      fontWeight: 600,
      flexShrink: 0,
      ...style,
    }}
  >
    {children}
  </span>
);

export const Mono: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <span style={{ fontFamily: MONO, fontSize: 12, color: C.violetLight, ...style }}>{children}</span>
);

/** Curseur de souris (pointeur macOS) en px vidéo. */
export const Cursor: React.FC<{ x: number; y: number; press?: number; opacity?: number }> = ({
  x,
  y,
  press = 0,
  opacity = 1,
}) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      opacity,
      transform: `scale(${1 - press * 0.15})`,
      transformOrigin: "0 0",
      filter: "drop-shadow(0 6px 14px rgba(0,0,0,0.6))",
      zIndex: 50,
    }}
  >
    <svg width="54" height="64" viewBox="0 0 27 32" fill="none">
      <path
        d="M2 2v23.5l6.2-6 4.3 10.2 4.4-1.9-4.3-10h8.6L2 2Z"
        fill="white"
        stroke="#111"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  </div>
);

/** Onde de clic (px vidéo). */
export const ClickRipple: React.FC<{ x: number; y: number; p: number }> = ({ x, y, p }) =>
  p <= 0 || p >= 1 ? null : (
    <div
      style={{
        position: "absolute",
        left: x - 70,
        top: y - 70,
        width: 140,
        height: 140,
        borderRadius: 9999,
        border: `3px solid rgba(196,181,253,${0.9 * (1 - p)})`,
        transform: `scale(${0.2 + p * 1.1})`,
        zIndex: 49,
      }}
    />
  );
