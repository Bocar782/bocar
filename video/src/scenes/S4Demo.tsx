import { AbsoluteFill, useCurrentFrame } from "remotion";
import { easeInOut, easeOut, easeOutBack, tw, typed } from "../lib";
import { C, FONT, GRADIENT, UI_ZOOM } from "../theme";
import timing from "../timing.json";
import { Mark } from "../components/Background";
import { Kinetic } from "../components/Kinetic";
import { captionWindow, Shot, UiStage } from "../components/Shot";
import { ClickRipple, Cursor, ElevatedCard, GradientDot, PanelCard, PrimaryButton, UiRoot } from "../components/Ui";
import { HEADER_MARK } from "./S3Reveal";

const T = timing.demo;
const UI_TOP = 640;
const UI_W = 420;
const UI_LEFT = (1080 - UI_W * UI_ZOOM) / 2;
const TOPIC = "Comprendre la bourse et investir en partant de zéro";

// Libellés exacts de src/lib/courses/schemas.ts (STAGE_LABELS).
const STAGES = [
  "Analyse du sujet...",
  "Recherche d'exemples et de sources...",
  "Construction du programme...",
  "Création des chapitres...",
  "Résumé et quiz de module...",
  "Création du quiz final...",
  "Enregistrement de la formation...",
  "Formation prête.",
];

const press = (f: number, at: number) => (f >= at && f < at + 8 ? Math.sin(((f - at) / 8) * Math.PI) : 0);

/** JourneyBreadcrumb réel (course-generator.tsx). */
const Breadcrumb: React.FC<{ active: number }> = ({ active }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 20 }}>
    {["Sujet", "Diagnostic", "Plan", "Génération"].map((p, i) => (
      <div key={p} style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: i === active ? C.fg : i < active ? C.violetLight : "rgba(151,151,173,0.5)",
          }}
        >
          {p}
        </span>
        {i < 3 && <span style={{ height: 1, width: 24, background: i < active ? "rgba(139,92,246,0.5)" : C.border }} />}
      </div>
    ))}
  </div>
);

const GeneratorForm: React.FC<{ f: number }> = ({ f }) => {
  const text = typed(TOPIC, f, T.typeStart, T.typeEnd);
  const focus = tw(f, [T.typeStart - 8, T.typeStart], [0.6, 1]);
  const caret = f >= T.typeStart - 8 && f < T.click1 && Math.floor(f / 8) % 2 === 0;
  return (
    <div>
      <div style={{ textAlign: "center", fontSize: 24, fontWeight: 600, letterSpacing: "-0.025em" }}>
        Que veux-tu apprendre aujourd&apos;hui ?
      </div>
      <div style={{ textAlign: "center", fontSize: 14, color: C.muted, marginTop: 8 }}>
        Décris un sujet, Tavyra construit ta formation complète.
      </div>
      <div style={{ position: "relative", borderRadius: 28, padding: 1, marginTop: 32 }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 28,
            opacity: focus,
            background: "linear-gradient(to bottom right, rgba(76,124,243,0.5), rgba(255,255,255,0.1), rgba(139,92,246,0.5))",
            boxShadow: `0 0 ${50 * (focus - 0.6)}px rgba(139,92,246,0.35)`,
          }}
        />
        <div style={{ position: "relative", borderRadius: 28, background: "rgba(11,13,28,0.95)", padding: 14 }}>
          <div style={{ padding: "14px 12px", fontSize: 20, lineHeight: 1.6, minHeight: 96 }}>
            {text.length === 0 ? (
              <span style={{ color: "rgba(151,151,173,0.7)" }}>
                {caret && <span style={{ color: C.violetLight }}>|</span>}Que veux-tu apprendre ?
              </span>
            ) : (
              <span>
                {text}
                <span style={{ opacity: caret ? 1 : 0, color: C.violetLight, fontWeight: 300 }}>|</span>
              </span>
            )}
          </div>
          <div style={{ borderTop: `1px solid ${C.border}`, padding: "12px 12px 2px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, color: C.muted, fontVariantNumeric: "tabular-nums" }}>{text.length}/500</span>
              <span style={{ fontSize: 12, color: C.muted, textDecoration: "underline", textUnderlineOffset: 2, opacity: text ? 1 : 0.4 }}>
                Configuration rapide (sans diagnostic)
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
              <PrimaryButton disabled={!text} press={press(f, T.click1)}>
                Créer avec le diagnostic guidé
              </PrimaryButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const CHOICES = ["Je débute complètement", "J'ai quelques notions", "Je suis déjà à l'aise"];

const Diagnostic: React.FC<{ f: number }> = ({ f }) => {
  const hover = f >= T.hover ? tw(f, [T.hover, T.hover + 6], [0, 1]) : 0;
  const picked = f >= T.click2;
  return (
    <div>
      <Breadcrumb active={1} />
      <ElevatedCard>
        <div style={{ display: "flex", gap: 8 }}>
          <span style={{ height: 6, width: 24, borderRadius: 9999, background: GRADIENT }} />
        </div>
        <div style={{ marginTop: 16, fontSize: 12, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.025em", color: C.muted }}>
          Question 1
        </div>
        <div style={{ marginTop: 8, fontSize: 20, fontWeight: 600, lineHeight: 1.35 }}>
          Quel est ton niveau actuel en investissement ?
        </div>
        <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 8 }}>
          {CHOICES.map((c, i) => {
            const s = T.diagIn + 10 + i * 4;
            const p = tw(f, [s, s + 12], [0, 1], easeOut);
            const h = i === 0 ? hover : 0;
            return (
              <div
                key={c}
                style={{
                  borderRadius: 12,
                  border: `1px solid ${h > 0 ? `rgba(139,92,246,${0.25 + 0.35 * h})` : C.border}`,
                  background: picked && i === 0 ? "rgba(139,92,246,0.14)" : `rgba(255,255,255,${0.02 + 0.03 * h})`,
                  padding: `14px 16px 14px ${16 + 4 * h}px`,
                  fontSize: 14,
                  opacity: p,
                  transform: `translateY(${(1 - p) * 14}px) scale(${1 - press(f, T.click2) * 0.03})`,
                }}
              >
                {c}
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 24, fontSize: 12, color: C.muted, textDecoration: "underline", textUnderlineOffset: 2 }}>
          Passer directement à la configuration rapide (sans diagnostic)
        </div>
      </ElevatedCard>
    </div>
  );
};

const MODULES = [
  { title: "Les bases de la bourse", chapters: ["Qu'est-ce qu'une action ?", "Actions, obligations et ETF", "Comment fonctionne la bourse"] },
  { title: "Construire son portefeuille", chapters: ["Diversifier ses investissements", "Gérer le risque et ses émotions"] },
];

const Plan: React.FC<{ f: number }> = ({ f }) => {
  const st = (i: number) => tw(f, [T.planIn + 6 + i * 3, T.planIn + 18 + i * 3], [0, 1], easeOut);
  const fade = (i: number): React.CSSProperties => ({ opacity: st(i), transform: `translateY(${(1 - st(i)) * 12}px)` });
  return (
    <div>
      <Breadcrumb active={2} />
      <PanelCard>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <span style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.025em" }}>Plan proposé</span>
          <span
            style={{
              borderRadius: 9999,
              border: "1px solid rgba(139,92,246,0.25)",
              background: "rgba(139,92,246,0.08)",
              padding: "4px 12px",
              fontSize: 12,
              fontWeight: 500,
              color: C.violetLight,
            }}
          >
            ~60 min
          </span>
        </div>
        <ul style={{ margin: "16px 0 0", padding: 0, listStyle: "none", fontSize: 14, display: "flex", flexDirection: "column", gap: 8 }}>
          {["Comprendre actions, obligations et ETF", "Construire un portefeuille diversifié"].map((o, i) => (
            <li key={o} style={{ display: "flex", gap: 10, ...fade(i) }}>
              <span style={{ color: C.violetLight }}>✓</span>
              {o}
            </li>
          ))}
        </ul>
        <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 12 }}>
          {MODULES.map((m, mi) => (
            <div
              key={m.title}
              style={{ borderRadius: 16, border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.02)", overflow: "hidden", ...fade(2 + mi * 3) }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, borderBottom: `1px solid ${C.border}`, background: "rgba(255,255,255,0.02)", padding: "10px 16px" }}>
                <GradientDot size={24}>{mi + 1}</GradientDot>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{m.title}</span>
              </div>
              <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                {m.chapters.map((c, ci) => (
                  <div
                    key={c}
                    style={{ borderRadius: 8, border: "1px solid rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.02)", padding: "7px 10px", fontSize: 13, ...fade(3 + mi * 3 + ci) }}
                  >
                    {c}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 20, ...fade(10) }}>
          <PrimaryButton press={press(f, T.click3)}>Valider et générer la formation</PrimaryButton>
        </div>
      </PanelCard>
    </div>
  );
};

const Generation: React.FC<{ f: number }> = ({ f }) => {
  const idx = Math.max(0, Math.min(7, Math.floor(tw(f, [T.genIn + 4, T.ready - 2], [0, 7.99], (t) => t))));
  const percent = Math.round(((idx + 1) / 8) * 100);
  const done = f >= T.ready;
  const pulse = done ? tw(f, [T.ready, T.ready + 14], [1, 0]) : 0;
  return (
    <div>
      <Breadcrumb active={3} />
      <div style={{ boxShadow: `0 0 ${120 * pulse}px rgba(139,92,246,${0.8 * pulse})`, borderRadius: 28 }}>
        <PanelCard>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{done ? "Formation prête" : "Génération en cours"}</span>
            <span style={{ fontSize: 12, fontWeight: 500, color: C.muted, fontVariantNumeric: "tabular-nums" }}>{percent}%</span>
          </div>
          <div style={{ marginTop: 12, height: 6, borderRadius: 9999, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${percent}%`, background: GRADIENT, borderRadius: 9999 }} />
          </div>
          <div style={{ position: "relative", marginTop: 24, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ position: "absolute", left: 13, top: 4, bottom: 4, width: 1, background: `linear-gradient(to bottom, ${C.border}, ${C.border}, transparent)` }} />
            {STAGES.map((s, i) => {
              const isDone = i < idx || (done && i === idx);
              const isActive = i === idx && !done;
              return (
                <div key={s} style={{ position: "relative", display: "flex", alignItems: "center", gap: 12 }}>
                  {isDone ? (
                    <GradientDot size={28}>✓</GradientDot>
                  ) : (
                    <span
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 9999,
                        flexShrink: 0,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 12,
                        fontWeight: isActive ? 600 : 400,
                        background: C.bgElevated,
                        border: isActive ? `2px solid ${C.violetLight}` : `1px solid ${C.border}`,
                        color: isActive ? C.violetLight : "rgba(151,151,173,0.5)",
                        boxShadow: isActive ? "0 0 0 4px rgba(139,92,246,0.12)" : undefined,
                      }}
                    >
                      {i + 1}
                    </span>
                  )}
                  <span style={{ fontSize: 14, fontWeight: isActive ? 500 : 400, color: isActive || (done && i === 7) ? C.fg : isDone ? C.muted : "rgba(151,151,173,0.4)" }}>
                    {s}
                  </span>
                  {isActive && <span style={{ marginLeft: "auto", width: 6, height: 6, borderRadius: 9999, background: C.violetLight, opacity: 0.5 + 0.5 * Math.sin(f) }} />}
                </div>
              );
            })}
          </div>
        </PanelCard>
      </div>
    </div>
  );
};

// Positions du curseur (px vidéo), calées sur le rendu.
export const CURSOR_PATH: { f: number; x: number; y: number }[] = [
  { f: T.typeEnd, x: 980, y: 1700 },
  { f: T.click1 - 2, x: 760, y: 1302 },
  { f: T.click1 + 10, x: 760, y: 1302 },
  { f: T.hover - 4, x: 420, y: 1112 },
  { f: T.click2 + 8, x: 420, y: 1112 },
  { f: T.click3 - 4, x: 410, y: 1790 },
  { f: T.click3 + 8, x: 410, y: 1790 },
  { f: T.genIn, x: 1180, y: 1900 },
];

function cursorAt(f: number) {
  const P = CURSOR_PATH;
  if (f <= P[0].f) return P[0];
  for (let i = 0; i < P.length - 1; i++) {
    if (f >= P[i].f && f <= P[i + 1].f) {
      const t = easeInOut((f - P[i].f) / Math.max(1, P[i + 1].f - P[i].f));
      return { f, x: P[i].x + (P[i + 1].x - P[i].x) * t, y: P[i].y + (P[i + 1].y - P[i].y) * t };
    }
  }
  return P[P.length - 1];
}

export const S4Demo: React.FC = () => {
  const f = useCurrentFrame();
  const headerText = tw(f, [0, 14], [0, 1], easeOut);
  const cur = cursorAt(f);
  const cursorOpacity = tw(f, [T.typeEnd - 2, T.typeEnd + 6], [0, 1]) * (1 - tw(f, [T.genIn - 6, T.genIn], [0, 1]));
  const clicks = [T.click1, T.click2, T.click3];
  const exit = tw(f, [236, 252], [0, 1], easeInOut);

  return (
    <AbsoluteFill>
      {/* En-tête du tableau de bord : le logo arrive de la scène précédente */}
      <div style={{ position: "absolute", left: HEADER_MARK.x, top: HEADER_MARK.y, display: "flex", alignItems: "center", gap: 18, opacity: 1 - exit }}>
        <Mark size={HEADER_MARK.size} />
        <span
          style={{
            fontFamily: FONT,
            fontSize: 46,
            fontWeight: 600,
            letterSpacing: "-0.025em",
            color: C.fg,
            opacity: headerText,
            transform: `translateX(${(1 - headerText) * -20}px)`,
          }}
        >
          Tavyra
        </span>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 216, height: 1, background: C.border, opacity: headerText * (1 - exit) }} />

      {/* Légendes */}
      <div style={{ position: "absolute", top: 300, width: 1080, opacity: 1 - exit }}>
        {captionWindow(f, 0, T.diagIn - 4) && <Kinetic text={"Écris simplement\nce que tu veux apprendre."} start={1} out={T.diagIn - 6} size={78} highlight={["apprendre."]} />}
        {captionWindow(f, T.diagIn, T.planIn - 4) && <Kinetic text={"Tavyra cerne\nton niveau."} start={T.diagIn + 2} out={T.planIn - 6} size={96} highlight={["niveau."]} />}
        {captionWindow(f, T.planIn, T.genIn - 4) && <Kinetic text={"Tu valides\nton plan."} start={T.planIn + 2} out={T.genIn - 6} size={96} highlight={["plan."]} />}
        {captionWindow(f, T.genIn, 240) && <Kinetic text={"Ta formation\nse construit."} start={T.genIn + 2} size={96} highlight={["formation"]} />}
      </div>

      <div
        style={{
          position: "absolute",
          inset: 0,
          transform: `scale(${1 + exit * 0.6}) translateY(${-exit * 120}px)`,
          opacity: 1 - exit,
          filter: exit > 0 ? `blur(${exit * 16}px)` : undefined,
          transformOrigin: "50% 60%",
        }}
      >
        <UiStage>
        <Shot inAt={0} outAt={T.diagIn} top={UI_TOP + 60} dur={16}>
          <UiRoot zoom={UI_ZOOM} width={UI_W} style={{ marginLeft: UI_LEFT / UI_ZOOM }}>
            <GeneratorForm f={f} />
          </UiRoot>
        </Shot>
        <Shot inAt={T.diagIn} outAt={T.planIn} top={UI_TOP}>
          <UiRoot zoom={UI_ZOOM} width={UI_W} style={{ marginLeft: UI_LEFT / UI_ZOOM }}>
            <Diagnostic f={f} />
          </UiRoot>
        </Shot>
        <Shot inAt={T.planIn} outAt={T.genIn} top={UI_TOP - 20} pan={[0, -90]}>
          <UiRoot zoom={UI_ZOOM} width={UI_W} style={{ marginLeft: UI_LEFT / UI_ZOOM }}>
            <Plan f={f} />
          </UiRoot>
        </Shot>
        <Shot inAt={T.genIn} top={UI_TOP}>
          <UiRoot zoom={UI_ZOOM} width={UI_W} style={{ marginLeft: UI_LEFT / UI_ZOOM }}>
            <Generation f={f} />
          </UiRoot>
        </Shot>
        </UiStage>

        {clicks.map((c) => (
          <ClickRipple key={c} x={cursorAt(c).x + 6} y={cursorAt(c).y + 6} p={tw(f, [c, c + 14], [0, 1])} />
        ))}
        <Cursor x={cur.x} y={cur.y} opacity={cursorOpacity} press={clicks.reduce((a, c) => Math.max(a, press(f, c)), 0)} />
      </div>
    </AbsoluteFill>
  );
};

export { easeOutBack };
