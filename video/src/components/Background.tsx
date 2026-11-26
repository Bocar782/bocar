import { AbsoluteFill, Img, staticFile, useCurrentFrame } from "remotion";
import { C } from "../theme";

/**
 * Fond signature de Tavyra (globals.css : .aurora, .grid-overlay, .grain-overlay)
 * transposé au format vertical : halos violet/bleu très diffus qui dérivent,
 * grille subtile masquée, grain. `glow` module l'intensité des halos.
 */
export const Background: React.FC<{ glow?: number; grid?: number; tint?: "violet" | "blue" }> = ({
  glow = 1,
  grid = 1,
  tint = "violet",
}) => {
  const f = useCurrentFrame();
  const ax = Math.sin(f / 70) * 60;
  const ay = Math.cos(f / 90) * 40;
  const bx = Math.cos(f / 80) * 70;
  const by = Math.sin(f / 60) * 50;
  const first = tint === "violet" ? "139, 92, 246" : "76, 124, 243";
  const second = tint === "violet" ? "76, 124, 243" : "139, 92, 246";
  return (
    <AbsoluteFill style={{ backgroundColor: C.bg, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          opacity: glow,
          background: `
            radial-gradient(620px 520px at ${540 + ax}px ${-40 + ay}px, rgba(${first}, 0.42), transparent 70%),
            radial-gradient(560px 560px at ${1060 + bx}px ${620 + by}px, rgba(${second}, 0.22), transparent 70%),
            radial-gradient(700px 600px at ${80 - bx}px ${1700 - by}px, rgba(${first}, 0.20), transparent 70%)
          `,
        }}
      />
      <AbsoluteFill
        style={{
          opacity: 0.9 * grid,
          backgroundImage: `linear-gradient(to right, rgba(255,255,255,0.035) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255,255,255,0.035) 1px, transparent 1px)`,
          backgroundSize: "96px 96px",
          backgroundPosition: `0px ${(f * 0.6) % 96}px`,
          maskImage: "radial-gradient(ellipse 80% 45% at 50% 0%, black 30%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 80% 45% at 50% 0%, black 30%, transparent 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

/** Grain + vignette, posés au-dessus de tout pour unifier l'image. */
export const FilmFinish: React.FC = () => {
  const f = useCurrentFrame();
  const ox = Math.floor((f * 137) % 512);
  const oy = Math.floor((f * 251) % 512);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill
        style={{
          backgroundImage: `url(${staticFile("grain.png")})`,
          backgroundPosition: `${ox}px ${oy}px`,
          opacity: 0.07,
          mixBlendMode: "overlay",
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 120% 85% at 50% 45%, transparent 55%, rgba(0,0,0,0.55) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

export const Mark: React.FC<{ size: number; style?: React.CSSProperties }> = ({ size, style }) => (
  <Img src={staticFile("brand/tavyra-mark.png")} style={{ width: size, height: size, ...style }} />
);
