import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Sparks } from "@/components/customer/Motifs";
import { COMPARISON, COPY, MARKS, PAYOFF, PRICE, span } from "../spec";

/**
 * 8.5-11.5s. The payoff.
 *
 * The only act that leaves the phone. Everything up to here has been a device in
 * a room; the saving is stated by the ad itself, full frame, because it is the
 * one thing the viewer has to carry away and a number read off a simulated
 * screen is never as loud as a number said out loud.
 *
 * Three marks, all from spec.ts and all on the musical grid:
 *
 *   holdOld   112 is still up, carried across the cut so the eye does not lose it
 *   snapNew   it snaps to 87 - a snap, not a count, because the price does not
 *             gradually become cheaper, it is a different price
 *   saveHit   the saving lands on a bar downbeat, with the loudest accent in the
 *             track and the word "twenty-five" leaving the voiceover
 *
 * The energy is a single expanding ring of warm light and a scale overshoot.
 * That is the whole vocabulary - no confetti, no particles, no shimmer, because
 * every one of those reads as a casino and this is a claim about money that has
 * to be believed.
 */
export function Reveal() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const duration = span("revealIn", "humanIn");

  // Marks are absolute in the composition; inside this act they are relative.
  //
  // The springs start a few frames BEFORE their mark. A spring begun on the beat
  // is at zero on the beat and peaks a third of a second late, so the picture
  // arrives after the sound - the one sync error an audience hears every time.
  // Leading it means the element is substantially there as the accent lands.
  const LEAD = 5;
  const snapAt = PAYOFF.snapNew - MARKS.revealIn - LEAD;
  const hitAt = PAYOFF.saveHit - MARKS.revealIn - LEAD;

  // Full opacity on frame zero.
  //
  // This used to fade up over ten frames, which left the first frame of the most
  // important act in the ad completely empty - a hole at the exact cut the whole
  // edit builds towards. The price is carried across the cut, so it is already
  // there; only its scale settles.
  const oldIn = 1;
  const settle = interpolate(frame, [0, 8], [1.06, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // The strike through 112, drawn left to right as it is replaced.
  const strike = interpolate(frame, [snapAt - 4, snapAt + 4], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // 112 shrinks up and out of the way; 87 arrives on a spring beneath it.
  const demote = interpolate(frame, [snapAt, snapAt + 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const newPrice = spring({
    frame: frame - snapAt,
    fps,
    config: { damping: 14, stiffness: 210, mass: 0.7 },
    durationInFrames: 20,
  });

  const save = spring({
    frame: frame - hitAt,
    fps,
    config: { damping: 13, stiffness: 240, mass: 0.8 },
    durationInFrames: 20,
  });

  // One ring of light leaving the saving on the downbeat.
  const ring = interpolate(frame, [hitAt + LEAD, hitAt + LEAD + 26], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  return (
    <AbsoluteFill style={{ background: "#fdfaf4", overflow: "hidden" }}>
      {/* Background energy: a warm field that lifts on the hit and settles. */}
      <AbsoluteFill
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(70% 44% at 50% 52%, rgba(255,228,150,0.85) 0%, rgba(255,246,222,0.4) 46%, transparent 76%)",
          transform: `scale(${1 + save * 0.14})`,
          opacity: 0.55 + save * 0.45,
        }}
      />

      {ring > 0 && ring < 1 ? (
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
          <div
            aria-hidden="true"
            style={{
              width: 520,
              height: 520,
              borderRadius: "50%",
              border: "7px solid rgba(255,200,60,0.55)",
              transform: `scale(${0.5 + ring * 2.6})`,
              opacity: (1 - ring) * 0.8,
            }}
          />
        </AbsoluteFill>
      ) : null}

      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 0 }}>
        {/* The old price, demoted rather than deleted - the comparison only
            works while both numbers are visible. */}
        <div
          style={{
            position: "relative",
            opacity: oldIn * (1 - demote * 0.42),
            transform: `scale(${interpolate(demote, [0, 1], [1, 0.42]) * settle}) translateY(${demote * -26}px)`,
          }}
        >
          <span
            style={{
              fontSize: 200,
              fontWeight: 800,
              letterSpacing: -8,
              color: "#9a9aa3",
              fontVariantNumeric: "tabular-nums",
              lineHeight: 1,
            }}
          >
            {PRICE.currency} {PRICE.old}
          </span>
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              left: -10,
              right: -10,
              top: "52%",
              height: 12,
              background: "#9a9aa3",
              borderRadius: 8,
              transformOrigin: "left center",
              transform: `scaleX(${strike})`,
            }}
          />
        </div>

        {/* The new price. */}
        <div
          style={{
            marginTop: interpolate(demote, [0, 1], [0, -6]),
            opacity: newPrice,
            transform: `scale(${interpolate(newPrice, [0, 1], [0.6, 1])})`,
          }}
        >
          <p
            style={{
              fontSize: 240,
              fontWeight: 800,
              letterSpacing: -12,
              color: "#1e8a4c",
              lineHeight: 0.9,
              fontVariantNumeric: "tabular-nums",
              textAlign: "center",
            }}
          >
            {PRICE.currency} {PRICE.new}
          </p>
          <p
            style={{
              textAlign: "center",
              fontSize: 40,
              fontWeight: 700,
              color: "#5b6478",
              marginTop: 4,
            }}
          >
            same basket on {COMPARISON.app}
          </p>
        </div>

        {/* The saving. */}
        <div
          style={{
            marginTop: 54,
            opacity: save,
            transform: `scale(${interpolate(save, [0, 1], [0.64, 1])})`,
            display: "flex",
            alignItems: "center",
            gap: 22,
            background: "#12121a",
            borderRadius: 999,
            padding: "30px 62px",
            boxShadow: "0 26px 80px rgba(120,80,0,0.32)",
          }}
        >
          <span style={{ fontSize: 54, fontWeight: 800, color: "#ffffff" }}>
            {COPY.saveLead}
          </span>
          <span
            style={{
              fontSize: 100,
              fontWeight: 800,
              color: "#ffd84d",
              letterSpacing: -3,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {COPY.saveAmount}
          </span>
          <Sparks className="h-16 w-16" />
        </div>
      </AbsoluteFill>

      <span style={{ display: "none" }}>{duration}</span>
    </AbsoluteFill>
  );
}
