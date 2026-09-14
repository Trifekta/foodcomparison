import React from "react";
import { useCurrentFrame } from "remotion";
import { CURVE, ramp, track } from "../motion";
import { COMPARISON, COPY, PAYOFF, PRICE, sec } from "../spec";

/**
 * The dark act.
 *
 * The film goes dark exactly once, and this is what the darkness is for. Three
 * states, and the space between them matters as much as they do:
 *
 *   112 stays on screen, small, so the comparison is never asked to be
 *   remembered. 87 resolves out of the dark - opened by a mask rather than
 *   faded, because a price does not gradually become another price. Then 1.2
 *   seconds of nothing at all, which is the single most important empty stretch
 *   in the film, and only then the saving.
 *
 * Serif here, sans everywhere else. It is the only moment in the ad that is
 * allowed to sound like a conclusion.
 */
export function Payoff() {
  const frame = useCurrentFrame();
  const show = Math.min(ramp(frame, PAYOFF.dark, PAYOFF.dark + 8), 1 - ramp(frame, sec(11.5), sec(11.85)));

  // 112, small and secondary, carried in from the cart.
  const oldIn = ramp(frame, PAYOFF.small112 - 10, PAYOFF.small112 + 2, CURVE.out);
  const oldDim = 1 - ramp(frame, PAYOFF.land87 - 4, PAYOFF.land87 + 10) * 0.45;

  // 87 opens from its own centre line rather than fading in.
  const resolve87 = ramp(frame, PAYOFF.land87 - 6, PAYOFF.land87 + 8, CURVE.snap);
  const settle87 = track(frame, [
    { f: PAYOFF.land87 - 6, v: 0.93 },
    { f: PAYOFF.land87 + 10, v: 1, ease: CURVE.overshoot },
  ]);

  // 25 arrives with the brackets' big opening.
  const in25 = ramp(frame, PAYOFF.land25 - 4, PAYOFF.land25 + 12, CURVE.out);
  const scale25 = track(frame, [
    { f: PAYOFF.land25 - 4, v: 0.84 },
    { f: PAYOFF.land25 + 14, v: 1, ease: CURVE.overshoot },
  ]);

  return (
    <div style={{ position: "absolute", inset: 0, opacity: show, color: "#F6F1E6" }}>
      {/* 112 - small, and still there. */}
      <div
        style={{
          position: "absolute", left: 366, top: 452, width: 348, height: 150,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          opacity: oldIn * oldDim,
        }}
      >
        <p style={{ fontSize: 24, fontWeight: 700, letterSpacing: 2.6, color: "rgba(246,241,230,0.5)" }}>
          YOUR CART
        </p>
        <p
          style={{
            fontSize: 76, fontWeight: 700, letterSpacing: -2, marginTop: 4,
            fontVariantNumeric: "tabular-nums", color: "rgba(246,241,230,0.72)",
          }}
        >
          {PRICE.currency} {PRICE.old}
        </p>
      </div>

      {/* 87 - the same basket, resolved. */}
      <div
        style={{
          position: "absolute", left: 206, top: 688, width: 668, height: 300,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          opacity: resolve87 > 0 ? 1 : 0,
        }}
      >
        <p
          style={{
            fontSize: 26, fontWeight: 700, letterSpacing: 2.6,
            color: "rgba(246,241,230,0.55)", opacity: resolve87,
          }}
        >
          ON {COMPARISON.app.toUpperCase()}
        </p>
        <div
          style={{
            clipPath: `inset(${(1 - resolve87) * 50}% 0 ${(1 - resolve87) * 50}% 0)`,
            transform: `scale(${settle87})`,
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-serif)", fontSize: 210, lineHeight: 1.02,
              letterSpacing: -4, fontVariantNumeric: "tabular-nums", color: "#F6F1E6",
            }}
          >
            {PRICE.currency} {PRICE.new}
          </p>
        </div>
      </div>

      {/* 25 - the film's loudest object. */}
      <div
        style={{
          position: "absolute", left: 66, top: 1032, width: 948, height: 560,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          opacity: in25, transform: `scale(${scale25})`,
        }}
      >
        <p style={{ fontSize: 34, fontWeight: 700, letterSpacing: 3, color: "rgba(246,241,230,0.62)" }}>
          {PRICE.currency}
        </p>
        <p
          style={{
            fontFamily: "var(--font-serif)", fontSize: 392, lineHeight: 0.9,
            letterSpacing: -14, color: "#FFC61A", fontVariantNumeric: "tabular-nums",
          }}
        >
          {PRICE.saving}
        </p>
        <p style={{ fontSize: 52, fontWeight: 800, letterSpacing: 6, marginTop: 6 }}>
          {COPY.saved.toUpperCase()}
        </p>
      </div>
    </div>
  );
}
