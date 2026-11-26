import { AbsoluteFill, useCurrentFrame } from "remotion";
import { drift, easeIn, easeOut, easeOutBack, tw, typed } from "../lib";
import { C, FONT, MONO } from "../theme";
import timing from "../timing.json";
import { Kinetic } from "../components/Kinetic";

const T = timing.problem;
const CENTER = { x: 540, y: 860 };

type Frag = {
  id: string;
  x: number;
  y: number;
  w: number;
  rot: number;
  appear: number;
  depth: number;
  render: (f: number) => React.ReactNode;
};

const glass: React.CSSProperties = {
  borderRadius: 22,
  background: "linear-gradient(180deg, rgba(23,26,51,0.96), rgba(14,16,36,0.96))",
  border: "1px solid rgba(255,255,255,0.10)",
  boxShadow: "0 30px 80px -30px rgba(0,0,0,0.9)",
  fontFamily: FONT,
  color: C.fg,
  overflow: "hidden",
};

const QUERY = "par où commencer la bourse ?";

const SearchBar = (f: number) => {
  const text = typed(QUERY, f, 2, 22);
  const sugg = tw(f, [18, 28], [0, 1]);
  return (
    <div style={{ ...glass, borderRadius: 34, padding: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 20, padding: "26px 30px", fontSize: 36 }}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke={C.muted} strokeWidth="2" strokeLinecap="round">
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="M15.3 15.3 20 20" />
        </svg>
        <span>
          {text}
          <span style={{ opacity: Math.floor(f / 8) % 2 === 0 ? 1 : 0, color: C.violetLight }}>|</span>
        </span>
      </div>
      <div style={{ height: sugg * 222, opacity: sugg, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        {["quand on n'y connaît rien", "en partant de zéro", "sans se perdre"].map((s, i) => (
          <div key={s} style={{ padding: "16px 30px 16px 86px", fontSize: 30, color: C.muted, whiteSpace: "nowrap" }}>
            {QUERY.replace(" ?", "")} <span style={{ color: C.fg, fontWeight: 600 }}>{s}</span>
            {i === 0 ? "" : ""}
          </div>
        ))}
      </div>
    </div>
  );
};

const VideoCard = () => (
  <div style={glass}>
    <div
      style={{
        height: 260,
        background: "radial-gradient(circle at 30% 30%, #2a2f5c, #0d0f22 70%)",
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ width: 96, height: 96, borderRadius: 9999, background: "rgba(255,255,255,0.14)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="40" height="40" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" fill="white" /></svg>
      </div>
      <span style={{ position: "absolute", right: 16, bottom: 14, background: "rgba(0,0,0,0.8)", borderRadius: 8, padding: "4px 10px", fontFamily: MONO, fontSize: 24 }}>
        3:12:08
      </span>
      <div style={{ position: "absolute", left: 0, bottom: 0, height: 6, width: "7%", background: "#ef4444" }} />
    </div>
    <div style={{ padding: "18px 22px", fontSize: 28, lineHeight: 1.25 }}>
      Tout comprendre à la bourse <span style={{ color: C.muted }}>(partie 1/9)</span>
    </div>
  </div>
);

const PdfCard = () => (
  <div style={{ ...glass, display: "flex", alignItems: "center", gap: 20, padding: 24 }}>
    <div style={{ width: 70, height: 88, borderRadius: 10, background: "#ef4444", display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: 10, fontWeight: 700, fontSize: 20 }}>
      PDF
    </div>
    <div>
      <div style={{ fontSize: 28 }}>cours_finance_v3_FINAL.pdf</div>
      <div style={{ fontSize: 24, color: C.muted, marginTop: 6 }}>214 pages · jamais ouvert</div>
    </div>
  </div>
);

const ForumCard = () => (
  <div style={{ ...glass, padding: 24 }}>
    <div style={{ fontSize: 22, color: C.muted }}>Forum · posté en 2014</div>
    <div style={{ fontSize: 30, marginTop: 8, lineHeight: 1.25 }}>« Débutant complètement perdu, des conseils ? »</div>
    <div style={{ fontSize: 22, color: C.muted, marginTop: 12 }}>87 réponses · toutes différentes</div>
  </div>
);

const Sticky = () => (
  <div
    style={{
      background: "#fcd34d",
      color: "#3b2f05",
      borderRadius: 6,
      padding: "26px 24px",
      fontFamily: FONT,
      fontSize: 36,
      fontWeight: 600,
      boxShadow: "0 30px 60px -25px rgba(0,0,0,0.9)",
      transform: "rotate(2deg)",
    }}
  >
    à revoir ???
  </div>
);

const Notes = () => (
  <div style={{ ...glass, padding: 24, fontFamily: MONO, fontSize: 26, color: C.muted, lineHeight: 1.6 }}>
    <div>ETF = ??</div>
    <div style={{ textDecoration: "line-through" }}>obligation = action</div>
    <div>→ regarder vidéo 4</div>
  </div>
);

const Clock = () => (
  <div style={{ ...glass, borderRadius: 9999, padding: "14px 26px", fontFamily: MONO, fontSize: 34, display: "flex", gap: 12, alignItems: "center" }}>
    <span style={{ width: 14, height: 14, borderRadius: 9999, background: "#ef4444" }} />
    02:47
  </div>
);

const FRAGS: Frag[] = [
  { id: "video", x: 730, y: 1090, w: 520, rot: 5, appear: 30, depth: 1, render: VideoCard },
  { id: "pdf", x: 330, y: 1330, w: 500, rot: -4, appear: 34, depth: 0.9, render: PdfCard },
  { id: "forum", x: 700, y: 1520, w: 560, rot: 3, appear: 38, depth: 0.95, render: ForumCard },
  { id: "sticky", x: 860, y: 760, w: 290, rot: 8, appear: 42, depth: 1.05, render: Sticky },
  { id: "notes", x: 300, y: 1700, w: 440, rot: -7, appear: 46, depth: 0.85, render: Notes },
  { id: "clock", x: 820, y: 1790, w: 210, rot: -3, appear: 6, depth: 1, render: Clock },
];

const LINKS: [string, string][] = [
  ["search", "video"],
  ["video", "pdf"],
  ["pdf", "forum"],
  ["forum", "sticky"],
  ["notes", "video"],
];

export const S2Problem: React.FC = () => {
  const f = useCurrentFrame();
  const collapse = tw(f, [T.collapse, T.collapse + 26], [0, 1], easeIn);
  const camRot = drift(f, 1, 1.2);
  const camScale = 1 + f * 0.0012;
  const enter = tw(f, [0, 10], [0, 1]);

  // La barre de recherche se range quand les fragments arrivent.
  const sMove = tw(f, [28, 44], [0, 1], easeOut);
  const search = {
    x: 540 + (330 - 540) * sMove,
    y: 1000 + (780 - 1000) * sMove,
    s: 1 - 0.3 * sMove,
    rot: -6 * sMove,
  };

  const pos = (id: string) => {
    if (id === "search") return { x: search.x, y: search.y };
    const fr = FRAGS.find((g) => g.id === id)!;
    return { x: fr.x + drift(f, fr.x, 10), y: fr.y + drift(f, fr.y, 14) };
  };

  const toCenter = (x: number, y: number) => ({
    x: x + (CENTER.x - x) * collapse,
    y: y + (CENTER.y - y) * collapse,
  });

  const jitter = f > T.beats[2] && f < T.collapse ? 1 : 0;

  const core = tw(f, [T.collapse + 8, T.collapse + 28], [0, 1], easeIn);

  return (
    <AbsoluteFill style={{ opacity: enter }}>
      <AbsoluteFill style={{ transform: `rotate(${camRot}deg) scale(${camScale})` }}>
        {/* Liens qui cherchent une structure… et cassent */}
        <svg width={1080} height={1920} style={{ position: "absolute", inset: 0, opacity: 1 - collapse }}>
          {LINKS.map(([a, b], i) => {
            const s = T.beats[2] + i * 3;
            const draw = tw(f, [s, s + 10], [0, 1]);
            const flicker = f > s + 12 ? (Math.sin(f * 1.7 + i) > 0.2 ? 0.15 : 0.6) : 0.7;
            const A = pos(a);
            const B = pos(b);
            const len = Math.hypot(B.x - A.x, B.y - A.y);
            return (
              <line
                key={i}
                x1={A.x}
                y1={A.y}
                x2={B.x}
                y2={B.y}
                stroke="#fca5a5"
                strokeWidth={3}
                strokeDasharray="10 12"
                strokeDashoffset={len * (1 - draw)}
                opacity={draw > 0 ? flicker : 0}
                style={{ strokeDasharray: `${len * draw} ${len}` }}
              />
            );
          })}
        </svg>

        {/* Recherche */}
        {(() => {
          const p = toCenter(search.x, search.y);
          return (
            <div
              style={{
                position: "absolute",
                left: p.x - 450,
                top: p.y - 60,
                width: 900,
                transform: `scale(${search.s * (1 - collapse * 0.97)}) rotate(${search.rot + collapse * 90}deg) translate(${jitter * Math.sin(f * 3) * 4}px, 0)`,
                opacity: 1 - tw(f, [T.collapse + 18, T.collapse + 26], [0, 1]),
              }}
            >
              {SearchBar(f)}
            </div>
          );
        })()}

        {FRAGS.map((g, i) => {
          const p = tw(f, [g.appear, g.appear + 12], [0, 1], easeOutBack);
          if (f < g.appear) return null;
          const base = pos(g.id);
          const c = toCenter(base.x, base.y);
          const j = jitter * Math.sin(f * 2.6 + i * 2) * 5;
          return (
            <div
              key={g.id}
              style={{
                position: "absolute",
                left: c.x - g.w / 2,
                top: c.y - 80,
                width: g.w,
                transform: `scale(${p * g.depth * (1 - collapse * 0.97)}) rotate(${g.rot + j * 0.4 + collapse * (i % 2 ? 140 : -140)}deg) translate(${j}px, ${-j}px)`,
                opacity: Math.min(1, p * 1.4) * (1 - tw(f, [T.collapse + 18, T.collapse + 26], [0, 1])),
              }}
            >
              {g.render(f)}
            </div>
          );
        })}
      </AbsoluteFill>

      {/* Légendes */}
      <AbsoluteFill style={{ top: 300, height: 400, alignItems: "center", opacity: 1 - collapse }}>
        {f < T.beats[1] + 4 && (
          <Kinetic text={"Des heures\nà chercher."} start={T.beats[0] + 2} out={T.beats[1] - 4} size={112} />
        )}
        {f >= T.beats[1] - 2 && f < T.beats[2] + 4 && (
          <Kinetic text={"Des infos\néparpillées."} start={T.beats[1]} out={T.beats[2] - 4} size={112} />
        )}
        {f >= T.beats[2] - 2 && (
          <Kinetic text="Aucun plan." start={T.beats[2]} out={T.collapse + 4} size={150} weight={700} highlight={["plan"]} />
        )}
      </AbsoluteFill>

      {/* Noyau lumineux de l'implosion */}
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            position: "absolute",
            left: CENTER.x - 300,
            top: CENTER.y - 300,
            width: 600,
            height: 600,
            borderRadius: 9999,
            opacity: core,
            transform: `scale(${0.1 + core * 0.5})`,
            background: "radial-gradient(closest-side, #ffffff, rgba(196,181,253,0.9) 25%, rgba(139,92,246,0.35) 55%, transparent)",
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
