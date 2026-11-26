import { AbsoluteFill, useCurrentFrame } from "remotion";
import { easeInOut, easeOut, easeOutBack, tw } from "../lib";
import { C, GRADIENT, MONO, UI_ZOOM } from "../theme";
import timing from "../timing.json";
import { Mark } from "../components/Background";
import { Kinetic } from "../components/Kinetic";
import { captionWindow, Shot, UiStage } from "../components/Shot";
import {
  AccentBlue,
  AccentViolet,
  CheckDot,
  ClickRipple,
  Cursor,
  ElevatedCard,
  PrimaryButton,
  ProgressBar,
  SecondaryButton,
  UiRoot,
} from "../components/Ui";

const T = timing.immersion;
const S = T.shots;
const UI_W = 420;
const ZOOM = UI_ZOOM;
const LEFT = (1080 - UI_W * ZOOM) / 2 / ZOOM;
const TOP = 620;
const press = (f: number, at: number) => (f >= at && f < at + 8 ? Math.sin(((f - at) / 8) * Math.PI) : 0);
const fadeUp = (f: number, s: number, d = 12): React.CSSProperties => {
  const p = tw(f, [s, s + d], [0, 1], easeOut);
  return { opacity: p, transform: `translateY(${(1 - p) * 16}px)` };
};

const MODULES = [
  { title: "Les bases de la bourse", chapters: ["Qu'est-ce qu'une action ?", "Actions, obligations et ETF", "Comment fonctionne la bourse"] },
  { title: "Construire son portefeuille", chapters: ["Diversifier ses investissements", "Gérer le risque et ses émotions", "Passer à l'action"] },
];

/** Sommaire (course-sidebar.tsx, tiroir mobile ouvert) + en-tête de formation. */
const Syllabus: React.FC<{ f: number }> = ({ f }) => {
  const done = (f >= T.check1 ? 1 : 0) + (f >= T.check2 ? 1 : 0);
  const pct = tw(f, [T.check1, T.check1 + 10], [0, 17]) + tw(f, [T.check2, T.check2 + 10], [0, 16]);
  let row = 0;
  return (
    <div>
      <div style={{ display: "flex", gap: 8, fontSize: 12, color: C.muted, ...fadeUp(f, 0) }}>
        <span style={{ borderRadius: 9999, border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.03)", padding: "4px 12px", fontWeight: 500, color: C.fg }}>finance</span>
        <span style={{ borderRadius: 9999, border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.03)", padding: "4px 12px" }}>Niveau débutant</span>
      </div>
      <div style={{ marginTop: 14, fontSize: 28, fontWeight: 600, lineHeight: 1.15, letterSpacing: "-0.025em", ...fadeUp(f, 2) }}>
        Comprendre la bourse et investir, en partant de zéro
      </div>
      <div style={{ marginTop: 20, borderRadius: 16, border: `1px solid ${C.border}`, background: "rgba(11,13,28,0.95)", padding: 16, ...fadeUp(f, 6) }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.muted }}>
          <span>{done}/6 leçons terminées</span>
          <span style={{ fontWeight: 600, color: C.fg, fontVariantNumeric: "tabular-nums" }}>{Math.round(pct)}%</span>
        </div>
        <ProgressBar percent={pct} style={{ marginTop: 8 }} />
        <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 2 }}>
          {MODULES.map((m, mi) => (
            <div key={m.title}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.025em", color: C.muted, ...fadeUp(f, 8 + row++ * 2) }}>
                <span>{m.title}</span>
                <span style={{ transform: "rotate(90deg)", fontSize: 9 }}>▶</span>
              </div>
              <div style={{ marginLeft: 6, borderLeft: `1px solid ${C.border}`, paddingLeft: 10 }}>
                {m.chapters.map((c, ci) => {
                  const pos = mi * 3 + ci;
                  const completed = pos < done;
                  const active = pos === done;
                  const pop = pos === 0 ? tw(f, [T.check1, T.check1 + 8], [0, 1], easeOutBack) : pos === 1 ? tw(f, [T.check2, T.check2 + 8], [0, 1], easeOutBack) : 0;
                  return (
                    <div
                      key={c}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        borderRadius: 8,
                        padding: "6px 10px",
                        fontSize: 14,
                        background: active ? "rgba(139,92,246,0.10)" : undefined,
                        color: active ? C.fg : C.muted,
                        ...fadeUp(f, 8 + row++ * 2),
                      }}
                    >
                      <span style={{ width: 16, height: 16, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                        {completed ? <CheckDot scale={pop} /> : <span style={{ width: 6, height: 6, borderRadius: 9999, background: "rgba(255,255,255,0.12)" }} />}
                      </span>
                      {c}
                    </div>
                  );
                })}
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", fontSize: 14, color: C.violetLight, ...fadeUp(f, 8 + row++ * 2) }}>
                  <span style={{ width: 16, textAlign: "center", fontSize: 10 }}>✎</span>
                  Quiz du module
                </div>
              </div>
            </div>
          ))}
          <div style={{ padding: "6px 10px", fontSize: 12, fontWeight: 500, color: C.muted, ...fadeUp(f, 8 + row++ * 2) }}>Résumé &amp; quiz final</div>
        </div>
      </div>
    </div>
  );
};

const Bold: React.FC<{ children: React.ReactNode; f: number; at: number }> = ({ children, f, at }) => {
  const p = tw(f, [at, at + 10], [0, 1], easeOut);
  return (
    <strong
      style={{
        fontWeight: 600,
        color: C.fg,
        backgroundImage: "linear-gradient(to right, rgba(139,92,246,0.35), rgba(76,124,243,0.25))",
        backgroundSize: `${p * 100}% 40%`,
        backgroundPosition: "0 90%",
        backgroundRepeat: "no-repeat",
      }}
    >
      {children}
    </strong>
  );
};

/** ChapterCard (course-view.tsx). */
const Chapter: React.FC<{ f: number }> = ({ f }) => {
  const s = S[1];
  return (
    <div style={{ borderRadius: 16, border: `1px solid ${C.border}`, background: "rgba(12,14,30,0.95)", padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ borderRadius: 9999, background: "linear-gradient(to right, rgba(76,124,243,0.15), rgba(139,92,246,0.15))", padding: "4px 12px", fontSize: 12, fontWeight: 600, color: C.violetLight }}>
          Chapitre 2
        </span>
        <SecondaryButton>Marquer comme terminée</SecondaryButton>
      </div>
      <div style={{ marginTop: 12, fontSize: 24, fontWeight: 600, letterSpacing: "-0.025em", lineHeight: 1.3 }}>Actions, obligations et ETF</div>
      <div style={{ marginTop: 16, fontSize: 15, lineHeight: 1.65, color: "rgba(244,244,251,0.85)" }}>
        <p style={{ margin: "0 0 12px", ...fadeUp(f, s + 6) }}>
          Une <Bold f={f} at={s + 16}>action</Bold> est une part d&apos;entreprise : tu en deviens copropriétaire et tu profites de sa croissance.
        </p>
        <p style={{ margin: "0 0 12px", ...fadeUp(f, s + 12) }}>
          Une <Bold f={f} at={s + 22}>obligation</Bold> est un prêt : tu prêtes ton argent en échange d&apos;intérêts.
        </p>
        <p style={{ margin: "0 0 12px", ...fadeUp(f, s + 18) }}>
          Un <Bold f={f} at={s + 28}>ETF</Bold> regroupe des dizaines d&apos;actifs dans un seul produit.
        </p>
      </div>
      <AccentBlue style={{ marginTop: 4, ...fadeUp(f, s + 30) }}>
        <span style={{ fontSize: 12, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.025em", color: C.blueLight }}>🔎 Exemple concret</span>
        <div style={{ marginTop: 8, fontSize: 14, lineHeight: 1.6, color: C.muted }}>
          Un ETF « monde » te rend actionnaire de plus d&apos;un millier d&apos;entreprises en une seule transaction.
        </div>
      </AccentBlue>
      <AccentViolet style={{ marginTop: 16, ...fadeUp(f, s + 40) }}>
        <span style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.025em", color: C.violetLight }}>★ À retenir</span>
        <div style={{ marginTop: 6, fontSize: 14, lineHeight: 1.6 }}>Action = propriété, obligation = prêt, ETF = panier diversifié.</div>
      </AccentViolet>
    </div>
  );
};

/** ExerciseBlock (exercise-block.tsx). */
const Exercise: React.FC<{ f: number }> = ({ f }) => {
  const open = tw(f, [T.reveal + 2, T.reveal + 16], [0, 1], easeInOut);
  return (
    <AccentBlue style={{ padding: 20, background: "rgba(14,16,34,0.96)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 24, height: 24, borderRadius: 9999, background: "rgba(76,124,243,0.15)", color: C.blueLight, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>✎</span>
        <span style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.025em", color: C.blueLight }}>Exercice pratique</span>
      </div>
      <div style={{ marginTop: 10, fontSize: 15, lineHeight: 1.6 }}>
        Tu disposes de <strong>1 000 €</strong>. Propose une répartition entre actions, obligations et ETF pour un profil <strong>prudent</strong>, puis justifie-la.
      </div>
      <div style={{ marginTop: 12 }}>
        <SecondaryButton press={press(f, T.reveal)}>{f >= T.reveal ? "Masquer la correction" : "Voir la correction"}</SecondaryButton>
      </div>
      <div style={{ height: open * 150, overflow: "hidden", opacity: open }}>
        <div style={{ marginTop: 12, borderRadius: 8, border: "1px solid rgba(139,92,246,0.25)", background: "rgba(139,92,246,0.08)", padding: 12, fontSize: 14, lineHeight: 1.6 }}>
          <span style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.025em", color: C.violetLight }}>Correction</span>
          <div style={{ marginTop: 6 }}>
            Par exemple : 50 % obligations pour la stabilité, 35 % ETF pour diversifier, 15 % actions pour viser la croissance.
          </div>
        </div>
      </div>
    </AccentBlue>
  );
};

const QUIZ = ["Investir dans une seule action", "Répartir ses investissements", "Acheter au plus bas", "Vendre au plus haut"];

/** QuizView (quiz-view.tsx) : question active puis résultats. */
const Quiz: React.FC<{ f: number }> = ({ f }) => {
  const picked = f >= T.quizPick;
  const results = tw(f, [T.score - 2, T.score + 8], [0, 1], easeInOut);
  const ring = tw(f, [T.score + 2, T.score + 26], [0, 9], easeOut);
  return (
    <ElevatedCard>
      <div style={{ position: "relative" }}>
        <div style={{ opacity: 1 - results, transform: `translateY(${-results * 20}px)` }}>
          <ProgressBar percent={40} height={4} />
          <div style={{ marginTop: 24 }}>
            <span style={{ fontFamily: MONO, fontSize: 12, color: C.violetLight }}>Question 4/10</span>
            <div style={{ marginTop: 8, fontSize: 18, fontWeight: 600, lineHeight: 1.35 }}>Que signifie « diversifier » un portefeuille ?</div>
            <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 10 }}>
              {QUIZ.map((q, i) => {
                const sel = picked && i === 1;
                return (
                  <div
                    key={q}
                    style={{
                      borderRadius: 12,
                      border: `1px solid ${sel ? "rgba(139,92,246,0.6)" : C.border}`,
                      background: sel ? "rgba(139,92,246,0.10)" : "rgba(255,255,255,0.02)",
                      padding: "12px 16px",
                      fontSize: 14,
                      color: sel ? C.fg : C.muted,
                      transform: `scale(${1 - (i === 1 ? press(f, T.quizPick) * 0.02 : 0)})`,
                      ...fadeUp(f, S[3] + 6 + i * 3),
                    }}
                  >
                    {q}
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end" }}>
              <PrimaryButton disabled={!picked} press={press(f, T.quizNext)}>Suivant</PrimaryButton>
            </div>
          </div>
        </div>
        {results > 0 && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", opacity: results, transform: `translateY(${(1 - results) * 20}px)` }}>
            <div style={{ fontSize: 18, fontWeight: 600, marginTop: 16 }}>Résultat du quiz</div>
            <div
              style={{
                marginTop: 24,
                width: 150,
                height: 150,
                borderRadius: 9999,
                background: `conic-gradient(${C.violet} ${(ring / 10) * 360}deg, rgba(255,255,255,0.06) 0deg)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: `0 0 60px rgba(139,92,246,${0.35 * results})`,
              }}
            >
              <div style={{ width: 122, height: 122, borderRadius: 9999, background: C.bgElevated, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 36, fontWeight: 600, letterSpacing: "-0.025em" }}>
                  {Math.round(ring)}
                  <span style={{ fontSize: 20, color: C.muted }}>/10</span>
                </span>
              </div>
            </div>
            <div style={{ marginTop: 18, fontSize: 14, color: C.muted, ...fadeUp(f, T.score + 18) }}>Belle maîtrise du sujet.</div>
            <div style={{ marginTop: 20, display: "flex", gap: 8, ...fadeUp(f, T.score + 22) }}>
              <span style={{ borderRadius: 9999, border: "1px solid rgba(139,92,246,0.4)", background: "rgba(139,92,246,0.10)", padding: "6px 14px", fontSize: 12 }}>Toutes les questions</span>
              <span style={{ borderRadius: 9999, border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.03)", padding: "6px 14px", fontSize: 12, color: C.muted }}>Mes erreurs uniquement</span>
            </div>
          </div>
        )}
      </div>
    </ElevatedCard>
  );
};

const ANSWER = "Un panier d'actifs que tu achètes en une seule fois, comme un mini-portefeuille déjà diversifié.";

/** ChapterChat (chapter-chat.tsx), panneau ouvert. */
const Chat: React.FC<{ f: number }> = ({ f }) => {
  const user = tw(f, [T.userMsg, T.userMsg + 10], [0, 1], easeOutBack);
  const typing = f >= T.typingStart && f < T.answerStart;
  const n = Math.round(tw(f, [T.answerStart, T.answerStart + 26], [0, ANSWER.length], (t) => t));
  return (
    <div style={{ borderRadius: 24, border: `1px solid ${C.border}`, background: "rgba(11,13,28,0.96)", overflow: "hidden", boxShadow: "0 40px 100px -30px rgba(0,0,0,0.9)" }}>
      <div style={{ height: 1, background: "linear-gradient(to right, rgba(76,124,243,0.6), rgba(139,92,246,0.6), rgba(76,124,243,0.6))" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, borderBottom: `1px solid ${C.border}`, padding: "14px 16px" }}>
        <Mark size={28} style={{ borderRadius: 8 }} />
        <div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Tavyra</div>
          <div style={{ fontSize: 12, color: C.muted }}>Chapitre 2 · Actions, obligations et ETF</div>
        </div>
      </div>
      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12, minHeight: 250 }}>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <div style={{ maxWidth: "85%", borderRadius: "16px 4px 16px 16px", background: GRADIENT, padding: "8px 14px", fontSize: 14, color: "white", boxShadow: "0 4px 16px -6px #8b5cf6", opacity: Math.min(1, user * 1.5), transform: `scale(${0.7 + 0.3 * user})`, transformOrigin: "100% 0" }}>
            C&apos;est quoi un ETF concrètement ?
          </div>
        </div>
        {typing && (
          <div style={{ display: "flex", gap: 4, width: 56, borderRadius: "4px 16px 16px 16px", border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.04)", padding: "12px 14px" }}>
            {[0, 1, 2].map((i) => (
              <span key={i} style={{ width: 6, height: 6, borderRadius: 9999, background: C.violetLight, opacity: 0.35 + 0.65 * Math.max(0, Math.sin(f / 3 - i)) }} />
            ))}
          </div>
        )}
        {n > 0 && (
          <div style={{ maxWidth: "85%", borderRadius: "4px 16px 16px 16px", border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.04)", padding: "8px 14px", fontSize: 14, lineHeight: 1.55 }}>
            {ANSWER.slice(0, n)}
          </div>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, borderTop: `1px solid ${C.border}`, padding: 12 }}>
        <div style={{ flex: 1, borderRadius: 12, border: `1px solid ${C.border}`, background: "rgba(255,255,255,0.03)", padding: "8px 12px", fontSize: 14, color: "rgba(151,151,173,0.6)" }}>
          Pose ta question...
        </div>
        <span style={{ width: 36, height: 36, borderRadius: 9999, background: GRADIENT, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </span>
      </div>
    </div>
  );
};

const CURSOR: { f: number; x: number; y: number }[] = [
  { f: S[2] + 4, x: 1000, y: 1650 },
  { f: T.reveal - 2, x: 262, y: 1296 },
  { f: T.reveal + 10, x: 262, y: 1296 },
  { f: S[3] - 2, x: 980, y: 1700 },
  { f: T.quizPick - 2, x: 470, y: 1084 },
  { f: T.quizPick + 2, x: 470, y: 1084 },
  { f: T.quizNext - 2, x: 850, y: 1482 },
  { f: T.quizNext + 6, x: 850, y: 1482 },
  { f: T.score + 6, x: 1150, y: 1800 },
];

function cursorAt(f: number) {
  const P = CURSOR;
  if (f <= P[0].f) return P[0];
  for (let i = 0; i < P.length - 1; i++) {
    if (f >= P[i].f && f <= P[i + 1].f) {
      const t = easeInOut((f - P[i].f) / Math.max(1, P[i + 1].f - P[i].f));
      return { x: P[i].x + (P[i + 1].x - P[i].x) * t, y: P[i].y + (P[i + 1].y - P[i].y) * t };
    }
  }
  return P[P.length - 1];
}

const CAPTIONS = [
  { text: "Des chapitres\nqui progressent.", hi: ["progressent."] },
  { text: "Des explications\nenfin claires.", hi: ["claires."] },
  { text: "Des exercices\npour pratiquer.", hi: ["pratiquer."] },
  { text: "Des quiz pour\nvalider tes acquis.", hi: ["acquis."] },
  { text: "Et Tavyra répond\nà tes questions.", hi: ["questions."] },
];

export const S5Immersion: React.FC = () => {
  const f = useCurrentFrame();
  const enter = tw(f, [0, 12], [0, 1], easeOut);
  const exit = tw(f, [292, 306], [0, 1], easeInOut);
  const cur = cursorAt(f);
  const cursorOpacity = tw(f, [S[2] + 4, S[2] + 10], [0, 1]) * (1 - tw(f, [T.score + 2, T.score + 8], [0, 1]));
  const clicks = [T.reveal, T.quizPick, T.quizNext];
  const ui = (children: React.ReactNode, zoom = ZOOM) => (
    <UiRoot zoom={zoom} width={UI_W} style={{ marginLeft: (1080 - UI_W * zoom) / 2 / zoom }}>
      {children}
    </UiRoot>
  );

  return (
    <AbsoluteFill
      style={{
        opacity: enter * (1 - exit),
        transform: `scale(${(0.92 + 0.08 * enter) * (1 - exit * 0.35)}) rotate(${exit * -6}deg)`,
        filter: exit > 0 ? `blur(${exit * 10}px)` : undefined,
      }}
    >
      <div style={{ position: "absolute", top: 300, width: 1080 }}>
        {CAPTIONS.map((c, i) => {
          const a = S[i];
          const b = S[i + 1] ?? 300;
          return captionWindow(f, a, b - 4) ? (
            <Kinetic key={i} text={c.text} start={a + 2} out={i < 4 ? b - 6 : undefined} size={90} highlight={c.hi} />
          ) : null;
        })}
      </div>

      <UiStage>
      <Shot inAt={0} outAt={S[1] - 7} top={TOP} pan={[0, -40]}>{ui(<Syllabus f={f} />)}</Shot>
      <Shot inAt={S[1] - 7} outAt={S[2] - 7} top={TOP} pan={[0, -260]}>{ui(<Chapter f={f} />)}</Shot>
      <Shot inAt={S[2] - 7} outAt={S[3] - 7} top={TOP + 300}>{ui(<Exercise f={f} />, 2.45)}</Shot>
      <Shot inAt={S[3] - 7} outAt={S[4] - 7} top={TOP}>{ui(<Quiz f={f} />)}</Shot>
      <Shot inAt={S[4] - 7} top={TOP + 20}>{ui(<Chat f={f} />, 2.45)}</Shot>
      </UiStage>

      {clicks.map((c) => (
        <ClickRipple key={c} x={cursorAt(c).x + 6} y={cursorAt(c).y + 6} p={tw(f, [c, c + 14], [0, 1])} />
      ))}
      <Cursor x={cur.x} y={cur.y} opacity={cursorOpacity} press={clicks.reduce((a, c) => Math.max(a, press(f, c)), 0)} />
    </AbsoluteFill>
  );
};
