import { useCurrentFrame } from "remotion";
import { easeInOut, tw } from "../lib";

/**
 * Plan "UI" avec entrée par le bas et sortie par le haut (effet de scroll
 * caméra), léger basculement 3D et flou de mouvement proportionnel à la vitesse.
 */
export const Shot: React.FC<{
  inAt: number;
  outAt?: number;
  dur?: number;
  top: number;
  children: React.ReactNode;
  pan?: [number, number];
  distance?: number;
}> = ({ inAt, outAt, dur = 14, top, children, pan = [0, 0], distance = 760 }) => {
  const f = useCurrentFrame();
  if (f < inAt - 1 || (outAt !== undefined && f > outAt + dur)) return null;
  const pin = tw(f, [inAt, inAt + dur], [0, 1], easeInOut);
  const pout = outAt === undefined ? 0 : tw(f, [outAt, outAt + dur], [0, 1], easeInOut);
  const y = (1 - pin) * distance - pout * distance;
  const v = (pin > 0 && pin < 1) || (pout > 0 && pout < 1) ? Math.sin(Math.PI * (pin < 1 ? pin : pout)) : 0;
  const panY = tw(f, [inAt, outAt ?? inAt + 60], pan, (t) => t);
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        width: 1080,
        top,
        transform: `perspective(2200px) translateY(${y + panY}px) rotateX(${(1 - pin) * 18 - pout * 18}deg) scale(${1 - v * 0.04})`,
        transformOrigin: "50% 0%",
        opacity: Math.min(pin * 1.6, 1 - Math.min(1, pout * 1.7)),
        filter: v > 0.02 ? `blur(${v * 7}px)` : undefined,
      }}
    >
      {children}
    </div>
  );
};

/** Légende cinétique alignée en haut, avec sortie. */
export const captionWindow = (f: number, a: number, b: number) => f >= a - 1 && f < b + 12;

/** Zone UI masquée en haut : le contenu qui "scrolle" disparaît sous la légende. */
export const UiStage: React.FC<{ children: React.ReactNode; fadeTop?: number }> = ({ children, fadeTop = 560 }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      maskImage: `linear-gradient(to bottom, transparent ${fadeTop}px, black ${fadeTop + 70}px)`,
      WebkitMaskImage: `linear-gradient(to bottom, transparent ${fadeTop}px, black ${fadeTop + 70}px)`,
    }}
  >
    {children}
  </div>
);
