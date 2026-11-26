import { AbsoluteFill, useCurrentFrame } from "remotion";
import { easeIn, easeInOut, easeOut, easeOutBack, tw } from "../lib";
import { C, FONT, GRADIENT } from "../theme";
import timing from "../timing.json";
import { Mark } from "../components/Background";
import { Kinetic } from "../components/Kinetic";
import { Tagline, Wordmark } from "../components/Brand";

const T = timing.cta;
const LOCK = { cx: 540, cy: 720, size: 330 };
const TAB = { cx: 540, cy: 1000, w: 600, h: 104 };
const FAV = { x: TAB.cx - TAB.w / 2 + 30, y: TAB.cy - 26, size: 52 };

export const S7Cta: React.FC = () => {
  const f = useCurrentFrame();
  const tabIn = tw(f, [T.tab, T.tab + 12], [0, 1], easeOutBack);
  const strike = tw(f, [T.tab + 12, T.tab + 20], [0, 1], easeOut);
  const textOut = tw(f, [T.morph - 6, T.morph + 6], [0, 1], easeIn);
  const morph = tw(f, [T.morph, T.morph + 22], [0, 1], easeInOut);
  const tabBodyOut = tw(f, [T.morph, T.morph + 8], [0, 1]);
  const burst = tw(f, [T.morph + 14, T.morph + 40], [0, 1], easeOut);
  const btn = tw(f, [T.button, T.button + 16], [0, 1], easeOutBack);
  const shimmer = tw(f, [T.shimmer, T.shimmer + 22], [-0.3, 1.3], easeInOut);
  const push = 1 + tw(f, [T.morph, 150], [0, 0.035], (t) => t);

  const size = FAV.size + (LOCK.size - FAV.size) * morph;
  const cx = FAV.x + FAV.size / 2 + (LOCK.cx - (FAV.x + FAV.size / 2)) * morph;
  const cy = FAV.y + FAV.size / 2 + (LOCK.cy - (FAV.y + FAV.size / 2)) * morph;
  const breathe = f > T.morph + 22 ? 1 + Math.sin((f - T.morph) / 14) * 0.012 : 1;

  return (
    <AbsoluteFill style={{ transform: `scale(${push})` }}>
      {/* Halo final */}
      <div
        style={{
          position: "absolute",
          left: LOCK.cx - 750,
          top: LOCK.cy - 750,
          width: 1500,
          height: 1500,
          borderRadius: 9999,
          opacity: morph * 0.8,
          background: "radial-gradient(closest-side, rgba(139,92,246,0.45), rgba(76,124,243,0.15) 50%, transparent 72%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: LOCK.cx - 400,
          top: LOCK.cy - 400,
          width: 800,
          height: 800,
          borderRadius: 9999,
          border: `4px solid rgba(196,181,253,${(1 - burst) * 0.8})`,
          transform: `scale(${0.3 + burst * 1.5})`,
          opacity: burst > 0 ? 1 : 0,
        }}
      />

      {/* Rappel du hook : 47 onglets -> un seul */}
      <div style={{ position: "absolute", top: 560, width: 1080, opacity: 1 - textOut, filter: textOut ? `blur(${textOut * 12}px)` : undefined }}>
        <div style={{ position: "relative", display: "flex", justifyContent: "center" }}>
          <Kinetic text="47 onglets ?" start={T.tab + 2} size={92} weight={500} color={C.muted} />
          <div style={{ position: "absolute", top: "54%", left: 540 - 290, width: 580 * strike, height: 7, borderRadius: 9, background: C.violet, boxShadow: "0 0 20px rgba(139,92,246,0.8)" }} />
        </div>
      </div>
      <div style={{ position: "absolute", top: 1160, width: 1080, opacity: 1 - textOut, filter: textOut ? `blur(${textOut * 12}px)` : undefined }}>
        <Kinetic text="Un seul suffit." start={T.line2} size={130} weight={700} highlight={["suffit."]} />
      </div>

      {/* L'onglet Tavyra */}
      <div
        style={{
          position: "absolute",
          left: TAB.cx - TAB.w / 2,
          top: TAB.cy - TAB.h / 2,
          width: TAB.w,
          height: TAB.h,
          transform: `scale(${tabIn * (1 + tabBodyOut * 0.15)})`,
          opacity: Math.min(1, tabIn * 2) * (1 - tabBodyOut),
          borderRadius: "24px 24px 8px 8px",
          background: "linear-gradient(180deg, #1b1e3d, #121430)",
          border: "1px solid rgba(196,181,253,0.35)",
          boxShadow: "0 30px 90px -20px rgba(139,92,246,0.55)",
          display: "flex",
          alignItems: "center",
          gap: 20,
          padding: `0 28px 0 ${30 + FAV.size + 18}px`,
          fontFamily: FONT,
          fontSize: 36,
          color: C.fg,
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ flex: 1 }}>
          <span style={{ fontWeight: 600 }}>Tavyra</span>
          <span style={{ color: C.muted }}> — Ta formation</span>
        </span>
        <span style={{ color: "#6b6b85" }}>×</span>
      </div>
      {f >= T.tab && (
        <div
          style={{
            position: "absolute",
            left: cx - size / 2,
            top: cy - size / 2,
            transform: `scale(${(morph > 0 ? breathe : tabIn)})`,
          }}
        >
          <Mark size={size} style={{ filter: `drop-shadow(0 0 ${10 + 40 * morph}px rgba(139,92,246,0.7))` }} />
        </div>
      )}

      {/* Lockup final */}
      <div style={{ position: "absolute", top: 935, width: 1080, display: "flex", flexDirection: "column", alignItems: "center", gap: 40 }}>
        {f >= T.morph + 8 && <Wordmark width={640} start={T.morph + 8} />}
        {f >= T.morph + 18 && <Tagline start={T.morph + 18} size={42} />}
      </div>

      <div style={{ position: "absolute", top: 1320, width: 1080, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div
          style={{
            position: "relative",
            overflow: "hidden",
            borderRadius: 9999,
            background: GRADIENT,
            padding: "38px 66px",
            fontFamily: FONT,
            fontSize: 46,
            fontWeight: 600,
            color: "white",
            letterSpacing: "-0.01em",
            boxShadow: "0 16px 70px -10px #8b5cf6",
            transform: `scale(${btn})`,
            opacity: Math.min(1, btn * 2),
            whiteSpace: "nowrap",
          }}
        >
          Crée ta première formation →
          <div
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: `${shimmer * 100}%`,
              width: 180,
              transform: "translateX(-50%) skewX(-20deg)",
              background: "linear-gradient(to right, transparent, rgba(255,255,255,0.45), transparent)",
            }}
          />
        </div>
        <div
          style={{
            marginTop: 48,
            fontFamily: FONT,
            fontSize: 46,
            fontWeight: 500,
            color: C.fg,
            letterSpacing: "-0.01em",
            opacity: tw(f, [T.button + 8, T.button + 20], [0, 1]),
            transform: `translateY(${(1 - tw(f, [T.button + 8, T.button + 20], [0, 1], easeOut)) * 20}px)`,
          }}
        >
          tavyra.netlify.app
        </div>
        <div
          style={{
            marginTop: 16,
            fontFamily: FONT,
            fontSize: 30,
            color: C.muted,
            opacity: tw(f, [T.button + 14, T.button + 26], [0, 1]),
          }}
        >
          Gratuit · sans carte bancaire
        </div>
      </div>
    </AbsoluteFill>
  );
};
