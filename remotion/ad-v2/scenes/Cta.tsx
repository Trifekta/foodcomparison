import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Wordmark } from "@/components/customer/Wordmark";
import { COPY, span } from "../spec";

/**
 * 14.0-17.5s. The end card.
 *
 * Held for three and a half seconds, which is long for a seventeen-second ad and
 * the right call: this is the only frame with an instruction in it, and a CTA
 * that leaves before it has been read has cost the entire spend.
 *
 * The wordmark is the shipping component, scaled - same argument as V1. The mark
 * in the last frame of the ad is provably the mark in the header of the page the
 * ad sends people to, which is the difference between a click that converts and
 * one that bounces because the landing page looked like a different company.
 *
 * The button does not pulse forever. It arrives, it settles, it stops. A control
 * that keeps moving reads as a banner ad.
 */
export function Cta() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const duration = span("ctaIn", "end");

  // The mark is on screen from frame zero and only settles; the end card cuts
  // in, it does not assemble itself while the viewer waits.
  const markIn = spring({
    frame: frame + 6,
    fps,
    config: { damping: 18, stiffness: 190, mass: 0.7 },
    durationInFrames: 20,
  });

  const headIn = interpolate(frame, [4, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const subIn = interpolate(frame, [16, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const buttonIn = spring({
    frame: frame - 28,
    fps,
    config: { damping: 15, stiffness: 180, mass: 0.8 },
    durationInFrames: 22,
  });

  // One settle, then still.
  const settle = interpolate(frame, [50, 62], [1, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: "#fdfaf4" }}>
      <AbsoluteFill
        aria-hidden="true"
        style={{
          background:
            "radial-gradient(66% 40% at 50% 34%, rgba(255,232,160,0.6) 0%, transparent 72%)",
        }}
      />

      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          padding: "0 90px",
          gap: 0,
        }}
      >
        <div
          style={{
            height: 150,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: markIn,
            transform: `scale(${interpolate(markIn, [0, 1], [0.7, 1])})`,
          }}
        >
          <div style={{ transform: "scale(4.2)" }}>
            <Wordmark size="lg" />
          </div>
        </div>

        <h1
          style={{
            marginTop: 64,
            fontSize: 96,
            fontWeight: 800,
            letterSpacing: -3.4,
            lineHeight: 1.03,
            textAlign: "center",
            color: "#12121a",
            whiteSpace: "pre-line",
            opacity: headIn,
            transform: `translateY(${(1 - headIn) * 28}px)`,
          }}
        >
          {COPY.ctaHead}
        </h1>

        <p
          style={{
            marginTop: 30,
            fontSize: 42,
            fontWeight: 600,
            textAlign: "center",
            color: "#5b6478",
            opacity: subIn,
            transform: `translateY(${(1 - subIn) * 18}px)`,
          }}
        >
          {COPY.ctaSub}
        </p>

        <div
          style={{
            marginTop: 66,
            opacity: buttonIn,
            transform: `scale(${interpolate(buttonIn, [0, 1], [0.82, 1]) * settle})`,
            background: "#ffd84d",
            color: "#12121a",
            borderRadius: 999,
            padding: "38px 86px",
            fontSize: 54,
            fontWeight: 800,
            letterSpacing: -0.8,
            boxShadow: "0 22px 60px rgba(200,150,0,0.30)",
          }}
        >
          {COPY.ctaButton}
        </div>
      </AbsoluteFill>

      <span style={{ display: "none" }}>{duration}</span>
    </AbsoluteFill>
  );
}
