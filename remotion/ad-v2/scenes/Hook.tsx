import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { COPY, PRICE, span } from "../spec";
import { HOOK } from "../slots";
import { NightApartment, Plate, ThumbSilhouette } from "../plates";
import { Phone } from "../phone";
import { CartScreen } from "../screens";
import { useCameraPush } from "../film";

/**
 * 0.0-2.5s. The hook.
 *
 * The whole ad is bought or lost here. Three rules shape it.
 *
 * It opens on the problem, not the brand - no logo, no riser, no establishing
 * anything. The first frame is a dark room and a bright screen with a number on
 * it, because that is the image the target audience recognises as themselves.
 *
 * The number is the subject. AED 112 is set larger than everything else in the
 * ad including the saving, is the only warm thing in a cold frame, and is
 * legible at the size a phone in a pocket renders it.
 *
 * And it moves from frame one: the push is already running when the ad starts
 * rather than easing in from rest, so there is no moment that reads as a
 * still.
 */
export function Hook() {
  const frame = useCurrentFrame();
  const duration = span("hookIn", "interruptIn");
  const push = useCameraPush({ from: 1.02, to: 1.16, durationInFrames: duration });

  // The thumb arrives late and does not quite get there - the ad interrupts it.
  const thumb = interpolate(frame, [26, duration], [0, 0.82], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  // The total warms up as the shot closes in on it.
  const totalHeat = interpolate(frame, [10, 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const typeIn = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // Near-immediate. At [8, 22] the first quarter-second of the ad showed "ABOUT
  // TO PAY / FOR DINNER?" with a gap where the number belongs - the hook with
  // its hook missing, during the only frames a scrolling viewer is guaranteed
  // to see.
  const priceIn = interpolate(frame, [1, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.back(1.6)),
  });

  return (
    <AbsoluteFill style={{ background: "#08090e" }}>
      <Plate slot={HOOK}>
        <NightApartment />
      </Plate>

      {/* The phone, low and tilted, the way it sits in a hand on a sofa. */}
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "flex-end",
          transform: `scale(${push})`,
        }}
      >
        <div style={{ transform: "rotate(-5deg) translateY(210px)" }}>
          <Phone width={640}>
            <CartScreen highlightTotal={totalHeat} />
          </Phone>
        </div>
      </AbsoluteFill>

      <ThumbSilhouette progress={thumb} />

      {/* A scrim so the type holds against whatever the plate is doing. */}
      <AbsoluteFill
        aria-hidden="true"
        style={{
          background:
            "linear-gradient(180deg, rgba(4,4,8,0.86) 0%, rgba(4,4,8,0.55) 38%, transparent 62%)",
        }}
      />

      <AbsoluteFill style={{ alignItems: "center", paddingTop: 168 }}>
        <div style={{ textAlign: "center", width: 940 }}>
          <p
            style={{
              fontSize: 52,
              fontWeight: 800,
              letterSpacing: 2,
              color: "rgba(255,255,255,0.82)",
              textTransform: "uppercase",
              opacity: typeIn,
              transform: `translateY(${(1 - typeIn) * 26}px)`,
            }}
          >
            About to pay
          </p>

          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "center",
              gap: 18,
              marginTop: 6,
              opacity: priceIn,
              transform: `scale(${interpolate(priceIn, [0, 1], [0.82, 1])})`,
            }}
          >
            <span
              style={{
                fontSize: 78,
                fontWeight: 800,
                color: "#ffd84d",
                letterSpacing: -1,
              }}
            >
              {PRICE.currency}
            </span>
            <span
              style={{
                fontSize: 232,
                fontWeight: 800,
                color: "#ffd84d",
                letterSpacing: -10,
                lineHeight: 0.86,
                fontVariantNumeric: "tabular-nums",
                textShadow: "0 0 70px rgba(255,200,60,0.45)",
              }}
            >
              {PRICE.old}
            </span>
          </div>

          <p
            style={{
              fontSize: 58,
              fontWeight: 800,
              letterSpacing: 1,
              color: "#ffffff",
              textTransform: "uppercase",
              marginTop: 10,
              opacity: typeIn,
              transform: `translateY(${(1 - typeIn) * 18}px)`,
            }}
          >
            for dinner?
          </p>
        </div>
      </AbsoluteFill>

      {/* Accessible name for the act, never rendered. */}
      <span style={{ display: "none" }}>{COPY.hook}</span>
    </AbsoluteFill>
  );
}
