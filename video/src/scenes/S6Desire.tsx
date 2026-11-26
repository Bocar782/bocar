import { AbsoluteFill, useCurrentFrame } from "remotion";
import { easeIn, easeOut, tw } from "../lib";
import { C, FONT, TEXT_GRADIENT } from "../theme";
import timing from "../timing.json";
import { Kinetic } from "../components/Kinetic";
import { Badge, ProgressBar, SecondaryButton, UiRoot } from "../components/Ui";

const T = timing.desire;

type Course = { title: string; domain: string; level: string; pct: number; ch: string; quiz?: string };
const COURSES: Course[] = [
  { title: "Comprendre la bourse et investir", domain: "finance", level: "débutant", pct: 33, ch: "3/6" },
  { title: "Apprendre Python de zéro", domain: "programmation", level: "débutant", pct: 45, ch: "4/8" },
  { title: "La Révolution française, des causes aux conséquences", domain: "histoire", level: "intermédiaire", pct: 100, ch: "6/6", quiz: "9/10" },
  { title: "Lancer sa boutique en ligne", domain: "e-commerce", level: "débutant", pct: 20, ch: "2/7" },
  { title: "Les bases du japonais", domain: "langues", level: "débutant", pct: 0, ch: "1/6" },
  { title: "Maîtriser la publicité en ligne", domain: "marketing", level: "intermédiaire", pct: 71, ch: "5/7" },
  { title: "La physique, de Newton à Einstein", domain: "sciences", level: "débutant", pct: 50, ch: "4/8" },
  { title: "Créer son entreprise", domain: "business", level: "débutant", pct: 100, ch: "6/6", quiz: "10/10" },
  { title: "Comprendre l'IA générative", domain: "technologie", level: "débutant", pct: 25, ch: "2/8" },
  { title: "Préparer le bac de philo", domain: "études", level: "lycée", pct: 60, ch: "4/6" },
  { title: "Prendre la parole en public", domain: "soft skills", level: "débutant", pct: 14, ch: "1/7" },
  { title: "Les bases de la nutrition", domain: "santé", level: "débutant", pct: 83, ch: "5/6" },
];

/** CourseListItem (course-list-item.tsx). */
const CourseCard: React.FC<{ c: Course }> = ({ c }) => {
  const status = c.pct >= 100 ? "completed" : c.pct > 0 ? "in_progress" : "not_started";
  return (
    <div style={{ borderRadius: 16, border: `1px solid ${C.border}`, background: "rgba(13,15,31,0.97)", padding: 18, marginBottom: 16 }}>
      <Badge tone={status === "completed" ? "success" : status === "in_progress" ? "info" : "neutral"}>
        {status === "completed" ? "Terminée" : status === "in_progress" ? "En cours" : "Pas commencée"}
      </Badge>
      <div style={{ marginTop: 12, fontWeight: 500, lineHeight: 1.35, fontSize: 16, minHeight: 43 }}>{c.title}</div>
      <div style={{ marginTop: 4, fontSize: 12, color: C.muted }}>
        {c.domain} · niveau {c.level}
      </div>
      <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12 }}>
        <ProgressBar percent={c.pct} style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: C.muted }}>{c.pct}%</span>
      </div>
      <div style={{ marginTop: 12, display: "flex", gap: 12, fontSize: 12, color: C.muted }}>
        <span>Chapitre {c.ch}</span>
        {c.quiz && <span>Quiz : {c.quiz}</span>}
      </div>
      <SecondaryButton style={{ marginTop: 16, width: "100%", justifyContent: "center", padding: "8px 16px", color: C.fg, background: "rgba(255,255,255,0.05)" }}>
        {status === "not_started" ? "Commencer" : "Continuer"}
      </SecondaryButton>
    </div>
  );
};

const WORDS = ["Finance.", "Code.", "Histoire.", "Langues."];
const SLOT_H = 230;

/** Mots qui défilent verticalement dans une fenêtre masquée, calés sur les temps. */
const WordSlot: React.FC<{ f: number }> = ({ f }) => {
  // Position continue dans la liste : chaque mot arrive en 7 frames puis tient.
  let pos = -1;
  T.words.forEach((s, i) => {
    pos += tw(f, [s, s + 7], [0, 1], easeOut);
    void i;
  });
  const out = tw(f, [T.line - 8, T.line], [0, 1], easeIn);
  return (
    <div
      style={{
        position: "relative",
        height: SLOT_H,
        width: 1080,
        overflow: "hidden",
        maskImage: "linear-gradient(to bottom, transparent, black 22%, black 78%, transparent)",
        WebkitMaskImage: "linear-gradient(to bottom, transparent, black 22%, black 78%, transparent)",
        opacity: 1 - out,
      }}
    >
      <div style={{ transform: `translateY(${-pos * SLOT_H - out * SLOT_H}px)` }}>
        {WORDS.map((w, i) => {
          const d = Math.abs(i - pos);
          return (
            <div
              key={w}
              style={{
                height: SLOT_H,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: FONT,
                fontSize: 190,
                fontWeight: 700,
                letterSpacing: "-0.045em",
                filter: d > 0.05 ? `blur(${Math.min(1, d) * 10}px)` : undefined,
                ...(i % 2 === 1
                  ? { backgroundImage: TEXT_GRADIENT, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }
                  : { color: C.fg }),
              }}
            >
              {w}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const S6Desire: React.FC = () => {
  const f = useCurrentFrame();
  const enter = tw(f, [0, 14], [0, 1], easeOut);
  const exit = tw(f, [112, 128], [0, 1], easeIn);
  const cols = [0, 1, 2, 3];
  return (
    <AbsoluteFill style={{ opacity: 1 - exit * 0.9 }}>
      {/* Mur de formations en perspective */}
      <AbsoluteFill style={{ perspective: 2000, opacity: enter }}>
        <div
          style={{
            position: "absolute",
            left: -560,
            top: -620,
            width: 2200,
            height: 3200,
            display: "flex",
            gap: 40,
            justifyContent: "center",
            transform: `rotateX(32deg) rotateZ(-16deg) translateZ(${-200 + f * 1.2 + exit * 900}px) scale(${1.3 - enter * 0.15})`,
            transformStyle: "preserve-3d",
          }}
        >
          {cols.map((ci) => {
            const dir = ci % 2 === 0 ? -1 : 1;
            const offset = dir * f * 3.2 - (ci % 2 === 0 ? 0 : 900);
            const list = [...COURSES.slice(ci * 3), ...COURSES, ...COURSES.slice(0, ci * 3)];
            return (
              <div key={ci} style={{ transform: `translateY(${offset}px)` }}>
                <UiRoot zoom={1.9} width={270}>
                  {list.map((c, i) => (
                    <CourseCard key={i} c={c} />
                  ))}
                </UiRoot>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>

      {/* Voile pour la lisibilité */}
      <AbsoluteFill style={{ background: "radial-gradient(ellipse 75% 32% at 50% 48%, rgba(6,7,15,0.94) 30%, rgba(6,7,15,0.55) 70%, rgba(6,7,15,0.2))" }} />
      <AbsoluteFill style={{ background: "linear-gradient(to bottom, rgba(6,7,15,0.85), transparent 18%, transparent 82%, rgba(6,7,15,0.9))" }} />

      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: 1 - tw(f, [102, 112], [0, 1]) }}>
        <div style={{ position: "relative", marginTop: -40, width: 1080, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div
            style={{
              fontFamily: FONT,
              fontSize: 30,
              fontWeight: 600,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: C.violetLight,
              opacity: tw(f, [2, 12], [0, 1]) * (1 - tw(f, [T.line - 6, T.line], [0, 1])),
              marginBottom: 26,
            }}
          >
            Un sujet, n&apos;importe lequel
          </div>
          <WordSlot f={f} />
          {f >= T.line - 2 && (
            <div style={{ position: "absolute", top: 0 }}>
              <Kinetic text={"Si tu peux le décrire,\ntu peux l'apprendre."} start={T.line} size={92} highlight={["l'apprendre."]} stagger={3} />
            </div>
          )}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
