import { loadFont } from "@remotion/fonts";
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame } from "remotion";
import timing from "./timing.json";
import { Background, FilmFinish } from "./components/Background";
import { S1Hook } from "./scenes/S1Hook";
import { S2Problem } from "./scenes/S2Problem";
import { S3Reveal } from "./scenes/S3Reveal";
import { S4Demo } from "./scenes/S4Demo";
import { S5Immersion } from "./scenes/S5Immersion";
import { S6Desire } from "./scenes/S6Desire";
import { S7Cta } from "./scenes/S7Cta";

loadFont({ family: "Geist", url: staticFile("fonts/Geist-Variable.woff2"), weight: "100 900" });
loadFont({ family: "Geist Mono", url: staticFile("fonts/GeistMono-Variable.woff2"), weight: "100 900" });

const S = timing.scenes;
const OVERLAP = 14;

export const TavyraAd: React.FC = () => {
  const f = useCurrentFrame();
  // Intensité des halos : sombre et oppressant pendant le problème, éclatant à la révélation.
  const glow = interpolate(
    f,
    [0, 90, 190, 210, 222, 300, 840, 960, 1110],
    [0.35, 0.25, 0.05, 0.05, 1.25, 1, 1, 0.8, 1],
    { extrapolateRight: "clamp" },
  );
  const grid = interpolate(f, [0, 200, 215, 300], [0.3, 0.3, 0, 1], { extrapolateRight: "clamp" });
  const scenes: [keyof typeof S, React.FC, number][] = [
    ["hook", S1Hook, OVERLAP],
    ["problem", S2Problem, 4],
    ["reveal", S3Reveal, 0],
    ["demo", S4Demo, OVERLAP],
    ["immersion", S5Immersion, OVERLAP],
    ["desire", S6Desire, 20],
    ["cta", S7Cta, 0],
  ];
  return (
    <AbsoluteFill style={{ backgroundColor: "#06070f" }}>
      <Background glow={glow} grid={grid} tint={f > 840 && f < 960 ? "blue" : "violet"} />
      {scenes.map(([key, Comp, extra]) => (
        <Sequence key={key} from={S[key][0]} durationInFrames={S[key][1] - S[key][0] + extra} name={key}>
          <Comp />
        </Sequence>
      ))}
      <FilmFinish />
      <Audio src={staticFile("audio/soundtrack.wav")} />
    </AbsoluteFill>
  );
};
