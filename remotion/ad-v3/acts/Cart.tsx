import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { CURVE, ramp, track } from "../motion";
import { CART, COPY, PRICE, sec } from "../spec";

/**
 * The cart, and what happens to it.
 *
 * One element across the first four and a half seconds. It is not a screenshot
 * of a delivery app and not a phone mockup - it is a designed object on cream,
 * because the film's job in Act 1 is to make a number felt, and a photograph of
 * somebody else's interface makes the viewer read chrome instead.
 *
 * It is also never cut away from. When the brackets close, this compresses
 * inside them and travels up into the scan, which is the first of the film's
 * physical handoffs.
 */

/** The card's natural box, which the bracket path is written against. */
export const CARD = { x: 96, y: 388, w: 888, h: 978 } as const;

export function Cart() {
  const frame = useCurrentFrame();

  // Compression. Non-uniform on purpose: it is squeezed, not shrunk.
  const sx = track(frame, [
    { f: sec(2.9), v: 1 },
    { f: sec(3.05), v: 616 / CARD.w, ease: CURVE.snap },
    { f: sec(3.9), v: 488 / CARD.w, ease: CURVE.inOut },
    { f: sec(5.0), v: 430 / CARD.w, ease: CURVE.out },
  ]);
  const sy = track(frame, [
    { f: sec(2.9), v: 1 },
    { f: sec(3.05), v: 322 / CARD.h, ease: CURVE.snap },
    { f: sec(3.9), v: 256 / CARD.h, ease: CURVE.inOut },
    { f: sec(5.0), v: 150 / CARD.h, ease: CURVE.out },
  ]);
  const ty = track(frame, [
    { f: sec(2.9), v: 0 },
    { f: sec(3.05), v: 726 + 322 / 2 - (CARD.y + CARD.h / 2), ease: CURVE.snap },
    { f: sec(3.9), v: 566 + 256 / 2 - (CARD.y + CARD.h / 2), ease: CURVE.inOut },
    { f: sec(5.0), v: 470 + 150 / 2 - (CARD.y + CARD.h / 2), ease: CURVE.out },
  ]);

  const enter = ramp(frame, 0, sec(0.7), CURVE.out);
  const fade = 1 - ramp(frame, sec(6.2), sec(7.0));

  // The total warms as the brackets arrive on it.
  const heat = ramp(frame, sec(1.1), sec(1.9));
  // Detail drops out once it is captured - a compressed object should not stay
  // fully legible, and keeping it sharp makes the compression look like a scale.
  const detail = 1 - ramp(frame, sec(3.0), sec(3.5));

  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <div
        style={{
          position: "absolute",
          left: CARD.x,
          top: CARD.y,
          width: CARD.w,
          height: CARD.h,
          transform: `translateY(${ty}px) scale(${sx}, ${sy})`,
          transformOrigin: "center center",
          background: "#FFFFFF",
          borderRadius: 40,
          border: "1px solid rgba(18,18,26,0.07)",
          boxShadow: "0 40px 90px rgba(60,45,10,0.07)",
          padding: 48,
          boxSizing: "border-box",
          opacity: enter,
        }}
      >
        <div style={{ opacity: detail }}>
          <p style={{ fontSize: 26, fontWeight: 700, letterSpacing: 1.6, color: "#9a9aa3" }}>
            YOUR ORDER
          </p>
          <p style={{ fontSize: 54, fontWeight: 800, letterSpacing: -1.4, marginTop: 8 }}>
            {CART.restaurant}
          </p>
          <p style={{ fontSize: 26, fontWeight: 600, color: "#9a9aa3", marginTop: 4 }}>
            {CART.meta}
          </p>

          <div style={{ marginTop: 34 }}>
            {CART.lines.map((l, i) => (
              <div
                key={l.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 18,
                  height: 88,
                  borderTop: i === 0 ? "none" : "1px solid #f2f2f5",
                }}
              >
                {l.qty ? (
                  <span
                    style={{
                      width: 44, height: 44, borderRadius: 12, background: "#f2f2f5",
                      color: "#55555f", fontSize: 24, fontWeight: 800,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    {l.qty}
                  </span>
                ) : (
                  <span style={{ width: 44 }} />
                )}
                <span style={{ fontSize: 30, fontWeight: l.qty ? 600 : 500, color: l.qty ? "#12121a" : "#7c8698" }}>
                  {l.name}
                </span>
                <span
                  style={{
                    marginLeft: "auto", fontSize: 30, fontWeight: 700,
                    fontVariantNumeric: "tabular-nums",
                    color: l.qty ? "#12121a" : "#7c8698",
                  }}
                >
                  {l.price}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* The total. The only warm thing in the frame. */}
        <div
          style={{
            position: "absolute",
            left: 80, right: 80, bottom: 58, height: 168,
            borderRadius: 28,
            background: `rgba(255,232,150,${0.10 + heat * 0.75})`,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "0 44px", boxSizing: "border-box",
          }}
        >
          <span style={{ fontSize: 32, fontWeight: 700, color: "#3c3c45", opacity: detail }}>
            Total
          </span>
          <span style={{ fontSize: 72, fontWeight: 800, letterSpacing: -2, fontVariantNumeric: "tabular-nums" }}>
            {PRICE.currency} {CART.total}
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
}

/** "AED 112 for dinner?" - set once, under the cart, and gone by the capture. */
export function Headline() {
  const frame = useCurrentFrame();
  const show = Math.min(ramp(frame, sec(0.55), sec(1.15)), 1 - ramp(frame, sec(2.2), sec(2.5)));
  const lift = (1 - ramp(frame, sec(0.55), sec(1.25))) * 26;

  return (
    <div
      style={{
        position: "absolute", left: 96, right: 96, top: 1452,
        textAlign: "center", opacity: show, transform: `translateY(${lift}px)`,
      }}
    >
      <p style={{ fontSize: 88, fontWeight: 800, letterSpacing: -3, color: "#12121a" }}>
        {COPY.headline}
      </p>
    </div>
  );
}
