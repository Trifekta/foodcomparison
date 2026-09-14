import { Composition } from "remotion";
// The product's real stylesheet: tokens, the script and marker utilities, and
// everything Tailwind generates from them. Imported rather than reproduced, so
// the ad cannot drift from the site.
import "../app/globals.css";
import { SnipSavorAd } from "./ad/SnipSavorAd";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./ad/spec";
import { SnipSavorAdV2 } from "./ad-v2/SnipSavorAdV2";
import * as v2 from "./ad-v2/spec";
import { SnipSavorAdV3 } from "./ad-v3/SnipSavorAdV3";
import * as v3 from "./ad-v3/spec";

export function RemotionRoot() {
  return (
    <>
      {/* V1: the 16:9 product film. Kept as it shipped. */}
      <Composition
        id="SnipSavorAd"
        component={SnipSavorAd}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />

      {/* V2: the vertical performance ad. */}
      <Composition
        id="SnipSavorAdV2"
        component={SnipSavorAdV2}
        durationInFrames={v2.DURATION_IN_FRAMES}
        fps={v2.FPS}
        width={v2.WIDTH}
        height={v2.HEIGHT}
      />

      {/* V3: the continuous motion-design film. */}
      <Composition
        id="SnipSavorAdV3"
        component={SnipSavorAdV3}
        durationInFrames={v3.DURATION_IN_FRAMES}
        fps={v3.FPS}
        width={v3.WIDTH}
        height={v3.HEIGHT}
      />
    </>
  );
}
