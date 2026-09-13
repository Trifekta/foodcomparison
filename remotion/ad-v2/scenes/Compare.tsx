import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { CART, COPY, span } from "../spec";
import { Phone } from "../phone";
import { ScanScreen } from "../screens";
import { useHandheld } from "../film";

/**
 * 6.5-8.5s. The check running.
 *
 * The brief's warning about a boring loading screen is the right one, and the
 * fix is not to animate a spinner harder - it is to show the actual work. Six
 * basket lines get found on the other app, one every eighth note, so the act has
 * six small beats of progress instead of one long wait.
 *
 * The line on screen is conditional on purpose. SnipSavor checks; it does not
 * promise, and an ad that says "we'll find you a better price" writes a cheque
 * the product explicitly refuses to write.
 */
export function Compare() {
  const frame = useCurrentFrame();
  const duration = span("compareIn", "revealIn");
  const hand = useHandheld(0.3);

  // One match every 7.5 frames - eighth notes at 120bpm - starting on the first
  // one rather than after it, so the act opens on progress instead of on an
  // untouched list.
  const matched = Math.min(
    CART.lines.length,
    Math.max(0, Math.floor((frame + 6) / 7.5)),
  );

  const settle = interpolate(frame, [0, 12], [0.93, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const labelIn = interpolate(frame, [2, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ background: "#fdfaf4" }}>
      {/* A slow warm sweep behind the phone, so the ground is not flat. */}
      <AbsoluteFill
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(64% 40% at 50% 44%, rgba(255,224,140,0.5) 0%, transparent 72%)",
          transform: `scale(${1 + (frame / duration) * 0.18})`,
        }}
      />

      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          transform: `translate(${hand.x * 0.4}px, ${hand.y * 0.4}px) scale(${settle})`,
        }}
      >
        <div style={{ transform: "translateY(64px)" }}>
          <Phone width={720} glow="rgba(255,216,77,0.32)">
            <ScanScreen matched={matched} />
          </Phone>
        </div>
      </AbsoluteFill>

      <AbsoluteFill style={{ alignItems: "center", paddingTop: 96 }}>
        <p
          style={{
            fontSize: 66,
            fontWeight: 800,
            letterSpacing: -1.6,
            color: "#12121a",
            opacity: labelIn,
            transform: `translateY(${(1 - labelIn) * 20}px)`,
          }}
        >
          {COPY.scanning}
        </p>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
