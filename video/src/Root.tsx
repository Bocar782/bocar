import { Composition } from "remotion";
import { TavyraAd } from "./TavyraAd";
import timing from "./timing.json";

export const Root = () => (
  <Composition
    id="TavyraAd"
    component={TavyraAd}
    durationInFrames={timing.total}
    fps={timing.fps}
    width={1080}
    height={1920}
  />
);
