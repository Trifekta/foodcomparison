import { AbsoluteFill, Easing, Series, interpolate, useCurrentFrame } from "remotion";
import { FOOD, REACTION } from "../slots";
import { FoodMacro, NightApartment, Plate } from "../plates";
import { Phone } from "../phone";
import { ResultScreen } from "../screens";
import { useCameraPush, useHandheld } from "../film";

/**
 * 11.5-14.0s. The human payoff.
 *
 * Two shots, cut on the beat between them: the result being read, then the food.
 *
 * This is the act that most wants the footage it does not have. The brief is
 * right that it should be a face - the same person, same sofa, same light,
 * reacting - and until REACTION is generated the beat is carried by the phone
 * showing the result in a room that has warmed up since the opening. It works,
 * and it is the weakest forty-five frames in the ad.
 *
 * Nothing is said over the first shot on purpose. After the saving lands the
 * edit needs a second of nothing, and an ad that keeps talking through its own
 * payoff has not understood what the payoff is for.
 */

/** 11.5-13.0s. The result, read. */
function Reading() {
  const hand = useHandheld(0.55);
  const push = useCameraPush({ from: 1.0, to: 1.07, durationInFrames: 45 });
  const frame = useCurrentFrame();

  // Present on frame zero.
  //
  // A cut is not a transition. Fading the shot up over twelve frames put a
  // near-empty frame immediately after the hardest cut in the ad; the phone is
  // already in shot and only its position settles.
  const arrive = interpolate(frame, [0, 14], [0.86, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  return (
    <AbsoluteFill style={{ background: "#0b0a0d" }}>
      <Plate slot={REACTION}>
        {/* The room, warmer than it was in the hook - the news is good. */}
        <NightApartment intensity={1.35} />
      </Plate>

      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          transform: `translate(${hand.x}px, ${hand.y}px) scale(${push})`,
        }}
      >
        <div
          style={{
            transform: `rotate(-4deg) translateY(${interpolate(arrive, [0.86, 1], [90, 130])}px) scale(${arrive})`,
          }}
        >
          <Phone width={620} glow="rgba(120,220,160,0.40)">
            <ResultScreen reveal={1} />
          </Phone>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

/** 13.0-14.0s. One second of food, cut hard in and hard out. */
function Food() {
  const push = useCameraPush({ from: 1.04, to: 1.14, durationInFrames: 30 });

  return (
    <AbsoluteFill>
      <Plate slot={FOOD}>
        <FoodMacro asset="food/burger.png" push={push} />
      </Plate>
    </AbsoluteFill>
  );
}

export function Human() {
  return (
    <Series>
      <Series.Sequence durationInFrames={45}>
        <Reading />
      </Series.Sequence>
      <Series.Sequence durationInFrames={30}>
        <Food />
      </Series.Sequence>
    </Series>
  );
}
