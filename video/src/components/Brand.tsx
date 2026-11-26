import { Img, staticFile, useCurrentFrame } from "remotion";
import { easeOut, tw } from "../lib";
import { C, FONT } from "../theme";

/** Wordmark officiel (détouré de l'image OG), révélé par un masque. */
export const Wordmark: React.FC<{ width: number; start: number; style?: React.CSSProperties }> = ({ width, start, style }) => {
  const f = useCurrentFrame();
  const p = tw(f, [start, start + 22], [0, 1], easeOut);
  return (
    <div style={{ width, position: "relative", ...style }}>
      <Img
        src={staticFile("brand/tavyra-wordmark.png")}
        style={{
          width,
          display: "block",
          clipPath: `inset(-20% ${(1 - p) * 100}% -20% 0)`,
          filter: `blur(${(1 - p) * 10}px) drop-shadow(0 0 30px rgba(139,92,246,${0.35 * p}))`,
          transform: `scaleX(${1.08 - 0.08 * p})`,
        }}
      />
    </div>
  );
};

/** Slogan officiel « Le savoir prend forme. » (style de l'image OG). */
export const Tagline: React.FC<{ start: number; size?: number }> = ({ start, size = 46 }) => {
  const f = useCurrentFrame();
  const p = tw(f, [start, start + 20], [0, 1], easeOut);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 28, opacity: p }}>
      <span style={{ height: 2, width: 90 * p, background: `linear-gradient(to right, transparent, ${C.violet})` }} />
      <span
        style={{
          fontFamily: FONT,
          fontSize: size,
          fontWeight: 400,
          color: C.fg,
          letterSpacing: `${0.22 - 0.08 * p}em`,
          whiteSpace: "nowrap",
        }}
      >
        Le savoir prend <span style={{ color: C.violet, fontWeight: 500 }}>forme.</span>
      </span>
      <span style={{ height: 2, width: 90 * p, background: `linear-gradient(to left, transparent, ${C.violet})` }} />
    </div>
  );
};

/** Étincelle à 4 branches (l'étoile du logo). */
export const Sparkle: React.FC<{ size: number; p: number }> = ({ size, p }) => (
  <svg
    width={size}
    height={size}
    viewBox="-50 -50 100 100"
    style={{ transform: `scale(${p}) rotate(${(1 - p) * 90}deg)`, filter: "drop-shadow(0 0 18px #c4b5fd)" }}
  >
    <path d="M0 -50 C4 -10 10 -4 50 0 C10 4 4 10 0 50 C-4 10 -10 4 -50 0 C-10 -4 -4 -10 0 -50Z" fill="white" />
  </svg>
);
