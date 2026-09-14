import React from "react";
import { Img, staticFile, useCurrentFrame } from "remotion";
import { Check } from "lucide-react";
import { CURVE, ramp, track } from "../motion";
import { CART, COMPARISON, COPY, sec } from "../spec";

/** "Check first." Two words, alone, while the cart is being carried away. */
export function CheckFirst() {
  const frame = useCurrentFrame();
  const show = Math.min(ramp(frame, sec(3.15), sec(3.5)), 1 - ramp(frame, sec(4.25), sec(4.5)));
  const rise = (1 - ramp(frame, sec(3.15), sec(3.6), CURVE.out)) * 34;

  return (
    <div
      style={{
        position: "absolute", left: 90, right: 90, top: 1120,
        textAlign: "center", opacity: show, transform: `translateY(${rise}px)`,
      }}
    >
      <p style={{ fontSize: 132, fontWeight: 800, letterSpacing: -5, color: "#12121a" }}>
        {COPY.checkFirst}
      </p>
    </div>
  );
}

/**
 * The check running.
 *
 * Findings appear where they are found rather than filling a dashboard: a
 * restaurant, then the basket ticking off line by line, then Keeta. The ticks
 * are the film's rhythm section - the sound design is built on them, not under
 * them.
 */
export function Scan() {
  const frame = useCurrentFrame();
  const show = Math.min(ramp(frame, sec(4.7), sec(5.0)), 1 - ramp(frame, sec(7.3), sec(7.5)));

  // One line every 4.5 frames from 5.1s - eighth notes at 100bpm.
  const matched = Math.max(0, Math.min(CART.lines.length, Math.floor((frame - sec(5.1)) / 4.5) + 1));

  const label = (at: number) => Math.min(ramp(frame, at, at + 6), 1 - ramp(frame, at + 30, at + 40));

  return (
    <div style={{ position: "absolute", inset: 0, opacity: show }}>
      <p
        style={{
          position: "absolute", left: 96, top: 690, fontSize: 30, fontWeight: 700,
          letterSpacing: 2.2, color: "#9a9aa3", opacity: label(sec(4.8)),
        }}
      >
        {COPY.scanRestaurant.toUpperCase()}
      </p>
      <p
        style={{
          position: "absolute", left: 96, top: 736, fontSize: 56, fontWeight: 800,
          letterSpacing: -1.6, color: "#12121a",
          opacity: ramp(frame, sec(4.85), sec(5.1)),
        }}
      >
        {CART.restaurant}
      </p>

      {/* The basket, ticking. */}
      <div style={{ position: "absolute", left: 96, right: 96, top: 850 }}>
        {CART.lines.map((l, i) => {
          const on = i < matched;
          const t = ramp(frame, sec(5.1) + i * 4.5, sec(5.1) + i * 4.5 + 7, CURVE.out);
          return (
            <div
              key={l.name}
              style={{
                display: "flex", alignItems: "center", gap: 20, height: 74,
                opacity: on ? 0.35 + t * 0.65 : 0.16,
                transform: `translateX(${(1 - (on ? t : 0)) * 18}px)`,
              }}
            >
              <span
                style={{
                  width: 40, height: 40, borderRadius: 999,
                  border: `2px solid ${on ? "#FFC61A" : "rgba(18,18,26,0.12)"}`,
                  background: on ? "#FFC61A" : "transparent",
                  color: "#12121a", display: "flex", alignItems: "center", justifyContent: "center",
                  transform: `scale(${on ? 0.7 + t * 0.3 : 0.7})`,
                }}
              >
                {on ? <Check size={22} strokeWidth={4} /> : null}
              </span>
              <span style={{ fontSize: 32, fontWeight: 600, color: "#12121a" }}>{l.name}</span>
              <span
                style={{
                  marginLeft: "auto", fontSize: 32, fontWeight: 700,
                  fontVariantNumeric: "tabular-nums",
                  color: on ? "#12121a" : "#c9c9d0",
                }}
              >
                {on ? l.price : "··"}
              </span>
            </div>
          );
        })}
      </div>

      <p
        style={{
          position: "absolute", left: 96, top: 1400, fontSize: 30, fontWeight: 700,
          letterSpacing: 2.2, color: "#9a9aa3", opacity: label(sec(6.4)),
        }}
      >
        {COPY.scanItems.toUpperCase()}
      </p>
      <p
        style={{
          position: "absolute", left: 96, right: 96, top: 1444, fontSize: 60, fontWeight: 800,
          letterSpacing: -1.8, color: "#12121a",
          opacity: ramp(frame, sec(6.5), sec(6.8)),
        }}
      >
        {COPY.scanKeeta}
      </p>
    </div>
  );
}

/**
 * The food.
 *
 * Held for barely a second and framed tight. The asset is a render rather than
 * a photograph, and a render survives a fast, cropped, half-lit second far
 * better than it survives a beauty shot - so it gets the second, not the shot.
 */
export function Food() {
  const frame = useCurrentFrame();
  const show = Math.min(ramp(frame, sec(11.7), sec(11.95)), 1 - ramp(frame, sec(13.6), sec(14.05)));

  // A yellow sweep uncovers it, travelling the same direction the brackets opened.
  const sweep = ramp(frame, sec(11.72), sec(12.18), CURVE.inOut);
  const push = track(frame, [
    { f: sec(11.7), v: 1.14 },
    { f: sec(13.8), v: 1.03, ease: CURVE.drift },
  ]);

  const copy = Math.min(ramp(frame, sec(12.35), sec(12.7)), 1 - ramp(frame, sec(13.5), sec(13.8)));

  return (
    <div style={{ position: "absolute", inset: 0, opacity: show }}>
      <div
        style={{
          position: "absolute", left: 86, top: 628, width: 908, height: 912,
          borderRadius: 8, overflow: "hidden",
          clipPath: `inset(0 ${(1 - sweep) * 100}% 0 0)`,
        }}
      >
        <Img
          src={staticFile("food/burger.png")}
          style={{
            position: "absolute", left: "50%", top: "50%",
            width: "185%", transform: `translate(-50%,-46%) scale(${push})`,
            filter: "saturate(1.1) contrast(1.08) brightness(0.96)",
          }}
        />
        <div
          style={{
            position: "absolute", inset: 0,
            background: "radial-gradient(62% 44% at 50% 46%, transparent 34%, rgba(8,6,4,0.72) 100%)",
          }}
        />
      </div>

      <p
        style={{
          position: "absolute", left: 96, right: 96, top: 1612,
          fontFamily: "var(--font-serif)", fontSize: 92, lineHeight: 1.02,
          letterSpacing: -1.5, color: "#F6F1E6", whiteSpace: "pre-line",
          opacity: copy,
        }}
      >
        {COPY.foodLine}
      </p>
      <span style={{ display: "none" }}>{COMPARISON.app}</span>
    </div>
  );
}
