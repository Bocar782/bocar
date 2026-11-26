import { useCurrentFrame } from "remotion";
import { easeOut, tw } from "../lib";
import { FONT, TEXT_GRADIENT } from "../theme";

/**
 * Titre cinétique : chaque mot monte depuis un masque avec un léger flou,
 * en cascade. `out` déclenche une sortie (montée + fondu).
 */
export const Kinetic: React.FC<{
  text: string;
  start: number;
  out?: number;
  size?: number;
  weight?: number;
  gradient?: boolean;
  color?: string;
  stagger?: number;
  align?: "center" | "left";
  lineHeight?: number;
  letterSpacing?: string;
  style?: React.CSSProperties;
  highlight?: string[];
}> = ({
  text,
  start,
  out,
  size = 96,
  weight = 600,
  gradient,
  color = "#f4f4fb",
  stagger = 3,
  align = "center",
  lineHeight = 1.05,
  letterSpacing = "-0.035em",
  style,
  highlight = [],
}) => {
  const f = useCurrentFrame();
  const lines = text.split("\n");
  let idx = 0;
  const outP = out === undefined ? 0 : tw(f, [out, out + 10], [0, 1], (t) => t * t);
  return (
    <div
      style={{
        fontFamily: FONT,
        fontSize: size,
        fontWeight: weight,
        lineHeight,
        letterSpacing,
        textAlign: align,
        color,
        opacity: 1 - outP,
        transform: `translateY(${-outP * 40}px)`,
        filter: outP > 0 ? `blur(${outP * 12}px)` : undefined,
        ...style,
      }}
    >
      {lines.map((line, li) => (
        <div key={li} style={{ display: "block" }}>
          {line.split(" ").map((word, wi) => {
            const i = idx++;
            const s = start + i * stagger;
            const p = tw(f, [s, s + 16], [0, 1], easeOut);
            const isHi = gradient || highlight.includes(word.replace(/[.,!?]/g, ""));
            return (
              <span
                key={wi}
                style={{
                  display: "inline-block",
                  overflow: "hidden",
                  verticalAlign: "top",
                  paddingBottom: "0.12em",
                  marginBottom: "-0.12em",
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    transform: `translateY(${(1 - p) * 105}%) rotate(${(1 - p) * 4}deg)`,
                    opacity: Math.min(1, p * 1.6),
                    filter: p < 1 ? `blur(${(1 - p) * 8}px)` : undefined,
                    ...(isHi
                      ? {
                          backgroundImage: TEXT_GRADIENT,
                          WebkitBackgroundClip: "text",
                          backgroundClip: "text",
                          color: "transparent",
                        }
                      : {}),
                  }}
                >
                  {word}
                  {wi < line.split(" ").length - 1 ? " " : ""}
                </span>
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};
