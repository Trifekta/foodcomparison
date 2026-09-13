import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { span } from "../spec";
import { Phone } from "../phone";
import { UploadScreen } from "../screens";
import { useHandheld } from "../film";

/**
 * 4.0-6.5s. Into the product.
 *
 * The transition the brief asks for: the phone comes at the camera, and the
 * room goes with it. Rather than cutting to a UI on a flat background - which is
 * the exact moment an ad turns into a SaaS demo - the device grows past the
 * frame edge until the screen is the frame, and the warm brand ground arrives
 * with it.
 *
 * This is also the ad's colour turn. Everything before it is a cold room;
 * everything after it is cream and gold. Holding the brand back for four seconds
 * is what makes it land as relief rather than as decoration.
 */
export function Upload() {
  const frame = useCurrentFrame();
  const duration = span("uploadIn", "compareIn");
  const hand = useHandheld(0.35);

  // The device travels towards the lens and settles.
  const approach = interpolate(frame, [0, 22], [0.66, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // The room dissolving as the screen takes over.
  const roomOut = interpolate(frame, [0, 18], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // The screenshot dropping into the upload frame, overlapping the device's
  // arrival rather than waiting for it - starting at frame 18 left the drop zone
  // visibly empty for the first two thirds of a second of the act.
  //
  // The screen carries its own "Upload your cart" heading, so the scene does not
  // repeat it in 74px type across the bottom of the phone - which was both a
  // duplicate of the line already on the glass and clipped by the frame edge.
  const drop = interpolate(frame, [9, 38], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  return (
    <AbsoluteFill style={{ background: "#fdfaf4" }}>
      {/* What is left of the room, going. */}
      <AbsoluteFill
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(80% 50% at 50% 40%, #15161e 0%, #08090e 100%)",
          opacity: roomOut,
        }}
      />

      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          transform: `translate(${hand.x * 0.5}px, ${hand.y * 0.5}px)`,
        }}
      >
        <div style={{ transform: `scale(${approach}) rotate(${-5 + approach * 5}deg)` }}>
          <Phone width={680} glow="rgba(255,216,77,0.34)">
            <UploadScreen progress={drop} />
          </Phone>
        </div>
      </AbsoluteFill>


      <span style={{ display: "none" }}>{duration}</span>
    </AbsoluteFill>
  );
}
