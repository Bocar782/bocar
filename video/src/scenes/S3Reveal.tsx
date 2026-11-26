import { AbsoluteFill, useCurrentFrame } from "remotion";
import { easeIn, easeInOut, easeOut, easeOutBack, tw } from "../lib";
import { C } from "../theme";
import timing from "../timing.json";
import { Mark } from "../components/Background";
import { Sparkle, Tagline, Wordmark } from "../components/Brand";

const T = timing.reveal;
export const HEADER_MARK = { x: 70, y: 104, size: 76 };

export const S3Reveal: React.FC = () => {
  const f = useCurrentFrame();
  const flash = tw(f, [0, 12], [1, 0], easeOut);
  const ring = tw(f, [0, 26], [0, 1], easeOut);
  const ring2 = tw(f, [4, 34], [0, 1], easeOut);
  const appear = tw(f, [0, 18], [0, 1], easeOutBack);

  // Raccord : le logo rejoint la position du logo de l'en-tête du tableau de bord (scène suivante).
  const m = tw(f, [T.exit, 90], [0, 1], easeInOut);
  const size0 = 400;
  const cx0 = 540;
  const cy0 = 800;
  const size = size0 + (HEADER_MARK.size - size0) * m;
  const cx = cx0 + (HEADER_MARK.x + HEADER_MARK.size / 2 - cx0) * m;
  const cy = cy0 + (HEADER_MARK.y + HEADER_MARK.size / 2 - cy0) * m;
  const scale = (0.55 + 0.45 * appear) * (1 + tw(f, [18, T.exit], [0, 0.04], (t) => t));

  const sparkle =
    f < T.sparkle ? 0 : f < T.sparkle + 8 ? tw(f, [T.sparkle, T.sparkle + 8], [0, 1.6], easeOut) : tw(f, [T.sparkle + 8, T.sparkle + 22], [1.6, 0.9]);
  const sparkleOut = tw(f, [T.exit - 4, T.exit + 6], [1, 0]);
  const textOut = tw(f, [T.exit - 6, T.exit + 8], [0, 1], easeIn);
  const glow = (1 - m) * (0.9 + Math.sin(f / 6) * 0.1);

  return (
    <AbsoluteFill>
      {/* Halo */}
      <div
        style={{
          position: "absolute",
          left: cx - 700,
          top: cy - 700,
          width: 1400,
          height: 1400,
          borderRadius: 9999,
          opacity: glow * 0.85,
          background: "radial-gradient(closest-side, rgba(139,92,246,0.55), rgba(76,124,243,0.18) 45%, transparent 70%)",
        }}
      />
      {/* Flare anamorphique */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: cy0 - 3,
          width: 1080,
          height: 6,
          opacity: tw(f, [0, 22], [1, 0]),
          background: "linear-gradient(to right, transparent, rgba(196,181,253,0.9), #fff, rgba(127,166,255,0.9), transparent)",
          filter: "blur(2px)",
          transform: `scaleX(${0.4 + ring})`,
        }}
      />
      {/* Ondes de choc */}
      {[ring, ring2].map((r, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: cx0 - 400,
            top: cy0 - 400,
            width: 800,
            height: 800,
            borderRadius: 9999,
            border: `${6 - i * 3}px solid rgba(196,181,253,${(1 - r) * (i ? 0.5 : 0.9)})`,
            transform: `scale(${0.15 + r * (1.6 + i * 0.5)})`,
          }}
        />
      ))}

      {/* Logo */}
      <div
        style={{
          position: "absolute",
          left: cx - size / 2,
          top: cy - size / 2,
          width: size,
          height: size,
          transform: `scale(${scale})`,
          opacity: Math.min(1, appear * 2),
        }}
      >
        <Mark size={size} style={{ filter: `drop-shadow(0 0 ${40 * (1 - m)}px rgba(139,92,246,0.8))` }} />
        <div
          style={{
            position: "absolute",
            left: size * (241 / 256) - size * 0.2,
            top: size * (72 / 256) - size * 0.2,
            opacity: sparkleOut,
          }}
        >
          <Sparkle size={size * 0.4} p={sparkle} />
        </div>
      </div>

      {/* Wordmark + slogan */}
      <div
        style={{
          position: "absolute",
          top: 1080,
          width: 1080,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 46,
          opacity: 1 - textOut,
          transform: `translateY(${textOut * 40}px)`,
          filter: textOut > 0 ? `blur(${textOut * 10}px)` : undefined,
        }}
      >
        <Wordmark width={700} start={T.wordmark} />
        <Tagline start={T.tagline} />
      </div>

      {/* Flash */}
      <AbsoluteFill
        style={{
          opacity: flash,
          background: `radial-gradient(circle at 50% ${cy0}px, #ffffff, ${C.violetLight} 35%, rgba(139,92,246,0.6) 70%)`,
        }}
      />
    </AbsoluteFill>
  );
};
