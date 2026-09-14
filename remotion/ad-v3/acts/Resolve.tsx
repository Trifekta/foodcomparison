import React from "react";
import { useCurrentFrame } from "remotion";
import { CURVE, ramp } from "../motion";
import { COPY, sec } from "../spec";
import { RESOLVE_WORDMARK } from "../path";
import { LogoCircle, Wordmark, circleForWordmark } from "../brand";

/**
 * Home.
 *
 * The brackets have been travelling for fourteen seconds; here they arrive at
 * the position they started life in, and the wordmark is already waiting under
 * them. The claim the whole film makes structurally - that it came out of the
 * logo - only pays off if this landing is exact, which is why the rect they
 * land on is computed from the supplied asset rather than placed by eye.
 *
 * The ring closes last. Because the circular treatment contains the same
 * wordmark at the same size, it cross-fades over the drawn lockup without
 * anything moving: what the viewer sees is a circle closing around a mark that
 * was already there.
 */
const CIRCLE = circleForWordmark(
  RESOLVE_WORDMARK.x,
  RESOLVE_WORDMARK.y,
  RESOLVE_WORDMARK.width,
);

/** The drawn lockup fades out exactly as the full asset fades in. */
export function wordmarkOpacity(frame: number): number {
  return 1 - ramp(frame, sec(16.5), sec(16.9));
}

export function Resolve() {
  const frame = useCurrentFrame();

  const wordIn = ramp(frame, sec(14.0), sec(14.5), CURVE.out);
  const ringIn = ramp(frame, sec(16.5), sec(16.9));

  const headIn = ramp(frame, sec(14.9), sec(15.4), CURVE.out);
  const subIn = ramp(frame, sec(15.3), sec(15.75));
  const btnIn = ramp(frame, sec(15.7), sec(16.1), CURVE.out);

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <Wordmark
        x={RESOLVE_WORDMARK.x}
        y={RESOLVE_WORDMARK.y}
        width={RESOLVE_WORDMARK.width}
        opacity={wordIn * wordmarkOpacity(frame)}
      />

      <LogoCircle x={CIRCLE.x} y={CIRCLE.y} width={CIRCLE.width} opacity={ringIn} />

      <div style={{ position: "absolute", left: 90, right: 90, top: 1148, textAlign: "center" }}>
        <h1
          style={{
            fontSize: 82, fontWeight: 800, letterSpacing: -2.6, lineHeight: 1.08,
            color: "#12121a", whiteSpace: "pre-line",
            opacity: headIn, transform: `translateY(${(1 - headIn) * 22}px)`,
          }}
        >
          {COPY.ctaHead}
        </h1>

        <p
          style={{
            marginTop: 26, fontSize: 36, fontWeight: 600, color: "#6b7386",
            opacity: subIn, transform: `translateY(${(1 - subIn) * 14}px)`,
          }}
        >
          {COPY.ctaSub}
        </p>

        <div
          style={{
            marginTop: 52, display: "inline-flex", alignItems: "center", gap: 22,
            background: "#12121a", color: "#FFFFFF", borderRadius: 999,
            padding: "34px 66px", fontSize: 46, fontWeight: 800, letterSpacing: -0.6,
            opacity: btnIn, transform: `scale(${0.94 + btnIn * 0.06})`,
          }}
        >
          {COPY.ctaButton}
          <span style={{ color: "#FFC61A" }}>&rarr;</span>
        </div>
      </div>
    </div>
  );
}
