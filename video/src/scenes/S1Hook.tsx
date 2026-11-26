import { AbsoluteFill, useCurrentFrame } from "remotion";
import { easeIn, easeOut, easeOutBack, rand, tw } from "../lib";
import { C, FONT } from "../theme";
import timing from "../timing.json";
import { Kinetic } from "../components/Kinetic";

const T = timing.hook;
const TITLES = [
  "Comment apprendre la bourse ?",
  "Cours finance débutant (PDF)",
  "Forum : par où commencer ?",
  "Tout comprendre en 3h12",
  "ETF, c'est quoi exactement ?",
  "Les 10 erreurs du débutant",
  "Vos conseils pour débuter ?",
  "Glossaire financier complet",
  "Tuto rapide (partie 4/9)",
  "Livre blanc — 214 pages",
  "Bourse pour les nuls ?",
  "Investir 100 € par mois ?",
  "Action vs obligation",
  "Thread : je suis perdu",
  "Résumé du chapitre 3",
  "Méthode miracle (2014)",
];
const FAVICONS = ["#ef4444", "#4c7cf3", "#f59e0b", "#9797ad", "#10b981", "#e5e7eb", "#8b5cf6"];

/** Inverse de l'easing du compteur : frame où le compteur atteint n. */
function frameForCount(n: number) {
  const p = (n - 3) / 44;
  return T.countEnd * (1 - Math.sqrt(1 - p));
}

export function countAt(f: number) {
  const t = Math.min(1, Math.max(0, f / T.countEnd));
  const p = 1 - (1 - t) * (1 - t);
  return Math.round(3 + 44 * p);
}

const Tab: React.FC<{ i: number; f: number; dim: number }> = ({ i, f, dim }) => {
  const appear = i < 3 ? -1 + i * 0.3 : frameForCount(i + 1) - 1;
  const p = tw(f, [appear, appear + 9], [0, 1], easeOutBack);
  if (f < appear) return null;
  // Disposition : spirale bruitée autour du centre, en évitant le compteur.
  const ang = i * 2.399 + rand(i) * 0.6;
  const rad = 300 + rand(i + 9) * 560 + (i % 3) * 40;
  const x = 540 + Math.cos(ang) * rad * 0.95;
  const y = 900 + Math.sin(ang) * rad * 1.25;
  const depth = 0.75 + rand(i + 3) * 0.8;
  const age = f - appear;
  const grow = 1 + age * 0.004 * depth;
  const rot = (rand(i + 5) - 0.5) * 18 + age * (rand(i + 7) - 0.5) * 0.25;
  const w = 340 + rand(i + 11) * 170;
  const far = depth < 0.95;
  return (
    <div
      style={{
        position: "absolute",
        left: x - w / 2,
        top: y - 38,
        width: w,
        height: 76,
        transform: `scale(${p * depth * grow}) rotate(${rot}deg)`,
        opacity: Math.min(1, p * 1.5) * (0.5 + depth * 0.5) * (1 - dim * 0.7),
        filter: far || dim > 0 ? `blur(${(far ? (0.95 - depth) * 12 : 0) + dim * 5}px)` : undefined,
        borderRadius: "18px 18px 6px 6px",
        background: "linear-gradient(180deg, #171a33, #10122a)",
        border: "1px solid rgba(255,255,255,0.10)",
        boxShadow: "0 20px 50px -20px rgba(0,0,0,0.9)",
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "0 20px",
        fontFamily: FONT,
        color: "#c9c9da",
        fontSize: 25,
        whiteSpace: "nowrap",
        overflow: "hidden",
      }}
    >
      <span
        style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, background: FAVICONS[i % FAVICONS.length], opacity: 0.85 }}
      />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>{TITLES[i % TITLES.length]}</span>
      <span style={{ color: "#6b6b85", fontSize: 26 }}>×</span>
    </div>
  );
};

export const S1Hook: React.FC = () => {
  const f = useCurrentFrame();
  const count = countAt(f);
  const landed = f >= T.countEnd;
  const punch = landed ? tw(f, [T.countEnd, T.countEnd + 8], [1.1, 1], easeOut) : 1;
  const shakeAmp = (f < T.countEnd ? (count / 47) * 7 : tw(f, [T.countEnd, T.countEnd + 10], [16, 0])) ;
  const sx = Math.sin(f * 2.1) * shakeAmp;
  const sy = Math.cos(f * 2.7) * shakeAmp;

  const counterOut = tw(f, [T.line1 - 6, T.line1 + 4], [0, 1], easeIn);
  const dim = tw(f, [T.line1 - 6, T.line1 + 6], [0, 1]);
  const exit = tw(f, [84, 98], [0, 1], easeIn);
  const camScale = 1 + f * 0.0015;

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          transform: `translate(${sx}px, ${sy}px) scale(${camScale + exit * 0.25})`,
          opacity: 1 - exit,
          filter: exit > 0 ? `blur(${exit * 14}px)` : undefined,
        }}
      >
        {Array.from({ length: 47 }).map((_, i) => (
          <Tab key={i} i={i} f={f} dim={dim} />
        ))}

        {/* Compteur */}
        <AbsoluteFill
          style={{
            alignItems: "center",
            justifyContent: "center",
            opacity: 1 - counterOut,
            transform: `translateY(${-counterOut * 120}px) scale(${punch})`,
            filter: counterOut > 0 ? `blur(${counterOut * 18}px)` : undefined,
          }}
        >
          <div
            style={{
              position: "absolute",
              width: 900,
              height: 900,
              borderRadius: 9999,
              background: "radial-gradient(closest-side, rgba(6,7,15,0.95), rgba(6,7,15,0.6) 60%, transparent)",
            }}
          />
          <div
            style={{
              fontFamily: FONT,
              fontWeight: 600,
              fontSize: 400,
              letterSpacing: "-0.06em",
              lineHeight: 0.9,
              color: C.fg,
              fontVariantNumeric: "tabular-nums",
              textShadow: landed ? "0 0 80px rgba(139,92,246,0.55)" : "0 0 40px rgba(139,92,246,0.25)",
              position: "relative",
            }}
          >
            {count}
          </div>
          <div
            style={{
              fontFamily: FONT,
              fontSize: 64,
              fontWeight: 500,
              color: C.muted,
              letterSpacing: "-0.02em",
              marginTop: 18,
              position: "relative",
            }}
          >
            onglets ouverts.
          </div>
        </AbsoluteFill>

        {/* Punchline */}
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
          <div
            style={{
              position: "absolute",
              width: 1100,
              height: 700,
              borderRadius: 9999,
              opacity: dim,
              background: "radial-gradient(closest-side, rgba(6,7,15,0.9), transparent)",
            }}
          />
          <div style={{ position: "relative", marginTop: -40 }}>
            <Kinetic text="Et tu n'as toujours" start={T.line1} size={86} weight={500} color={C.fg} />
            <Kinetic
              text="rien appris."
              start={T.line2}
              size={168}
              weight={700}
              gradient
              stagger={5}
              style={{ marginTop: 6 }}
            />
          </div>
        </AbsoluteFill>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
