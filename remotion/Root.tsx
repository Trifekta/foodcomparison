import { Composition } from "remotion";
// The product's real stylesheet: tokens, the script and marker utilities, and
// everything Tailwind generates from them. Imported rather than reproduced, so
// the ad cannot drift from the site.
import "../app/globals.css";
import { SnipSavorAd } from "./ad/SnipSavorAd";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./ad/spec";

export function RemotionRoot() {
  return (
    <Composition
      id="SnipSavorAd"
      component={SnipSavorAd}
      durationInFrames={DURATION_IN_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
  );
}
