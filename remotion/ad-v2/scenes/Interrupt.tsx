import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { COPY, span } from "../spec";
import { NightApartment } from "../plates";
import { Phone } from "../phone";
import { CartScreen } from "../screens";

/**
 * 2.5-4.0s. The interruption.
 *
 * The shortest act, and the only one whose job is to stop the previous one. A
 * screenshot is taken: the frame blows out for two frames, the screen snaps in
 * the way iOS does it, and two words land.
 *
 * "Check first." gets the frame to itself with nothing else moving. A cut this
 * fast needs one still point or it reads as a glitch rather than a decision.
 */
export function Interrupt() {
  const frame = useCurrentFrame();
  const duration = span("interruptIn", "uploadIn");

  // The capture: a hard white blowout on the cut, gone within three frames.
  const flash = interpolate(frame, [0, 2, 6], [0.92, 0.5, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // The screen pinches, the way a phone confirms it took the shot.
  const pinch = interpolate(frame, [0, 5, 12], [1, 0.9, 0.96], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  const wordIn = interpolate(frame, [7, 17], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.back(2)),
  });

  // It holds dead still, then leaves on the cut rather than fading.
  const wordOut = interpolate(frame, [duration - 5, duration], [1, 0.86], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ background: "#08090e" }}>
      <NightApartment intensity={0.7} />

      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ transform: `rotate(-5deg) scale(${pinch}) translateY(120px)` }}>
          <Phone width={560} glow="rgba(255,216,77,0.30)">
            <CartScreen highlightTotal={1} />
          </Phone>
        </div>
      </AbsoluteFill>

      <AbsoluteFill
        aria-hidden="true"
        style={{
          background:
            "linear-gradient(180deg, rgba(4,4,8,0.9) 0%, rgba(4,4,8,0.4) 40%, rgba(4,4,8,0.75) 100%)",
        }}
      />

      <AbsoluteFill style={{ alignItems: "center", paddingTop: 300 }}>
        <p
          style={{
            fontSize: 148,
            fontWeight: 800,
            letterSpacing: -4,
            color: "#ffffff",
            textAlign: "center",
            lineHeight: 0.96,
            opacity: wordIn,
            transform: `scale(${interpolate(wordIn, [0, 1], [0.78, 1]) * wordOut})`,
          }}
        >
          {COPY.interrupt}
        </p>
      </AbsoluteFill>

      {/* The capture itself, over everything. */}
      <AbsoluteFill
        aria-hidden="true"
        style={{ background: "#ffffff", opacity: flash, pointerEvents: "none" }}
      />
    </AbsoluteFill>
  );
}
