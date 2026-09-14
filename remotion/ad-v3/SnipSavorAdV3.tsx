import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { SANS, SERIF } from "./fonts";
import { DURATION_IN_FRAMES, sec } from "./spec";
import { brackets, groundDark } from "./path";
import { Brackets } from "./brand";
import { Cart, Headline } from "./acts/Cart";
import { CheckFirst, Deconstruct, Food } from "./acts/Middle";
import { Payoff } from "./acts/Payoff";
import { Resolve, wordmarkOpacity } from "./acts/Resolve";
import { Mix } from "./mix";
import { ramp } from "./motion";

/**
 * SnipSavor V3.
 *
 * One eighteen-second composition. There are no scenes and nothing unmounts:
 * every layer below is present for the whole film and simply has an opacity,
 * and the brackets are a single element whose entire path lives in path.ts.
 *
 * That is the structural answer to the brief's main rule. A cut cannot happen
 * by accident here, because there is nothing to cut between - the cart is
 * physically compressed and carried into the scan, the scanner flattens into the
 * bar that wipes the world dark, the frame that opens around the saving keeps
 * opening until it is the frame the food sits in, and the same four brackets
 * end the film by landing on the mark they came out of.
 */
export function SnipSavorAdV3() {
  const frame = useCurrentFrame();
  const b = brackets(frame);
  const dark = groundDark(frame);

  // Cream and near-black, mixed by one track. The switch happens once.
  const ground = interpolate(dark, [0, 1], [0, 1]);
  const bg = `rgb(${Math.round(253 + (11 - 253) * ground)}, ${Math.round(
    250 + (10 - 250) * ground,
  )}, ${Math.round(244 + (14 - 244) * ground)})`;

  // The brackets turn from brand yellow towards near-white in the dark act, so
  // they stay the same object rather than becoming a highlight.
  const bracketColor = dark > 0.5 ? "#FFC61A" : "#FFC61A";

  return (
    <AbsoluteFill
      style={
        {
          background: bg,
          "--font-sans": `"${SANS}", system-ui, sans-serif`,
          "--font-serif": `"${SERIF}", Georgia, serif`,
          fontFamily: "var(--font-sans)",
          color: "#12121a",
          overflow: "hidden",
        } as React.CSSProperties
      }
    >
      {/* Act 1-2: the cart, compressed and carried. */}
      <div style={{ opacity: 1 - ramp(frame, sec(7.2), sec(7.5)) }}>
        <Cart />
        <Headline />
        <CheckFirst />
        <Deconstruct />
      </div>

      {/* Act 4: the dark act. */}
      <Payoff />

      {/* Act 5: food. */}
      <Food />

      {/* Act 6: home. */}
      <div style={{ opacity: ramp(frame, sec(13.5), sec(13.9)) }}>
        <Resolve />
      </div>

      {/* The protagonist. One element, the whole film. It steps aside only for
          the ring, which contains its own copy of the brackets. */}
      <Brackets
        rect={b.rect}
        opacity={b.opacity * wordmarkOpacity(frame)}
        spread={b.spread}
        reach={b.reach}
        color={bracketColor}
      />

      <Mix />
    </AbsoluteFill>
  );
}

export const V3_DURATION = DURATION_IN_FRAMES;
