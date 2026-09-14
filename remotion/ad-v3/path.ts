import { CURVE, type Key, type RectKey, track, trackRect } from "./motion";
import { bracketRectForWordmark } from "./brand";
import { sec } from "./spec";

/**
 * The protagonist's path.
 *
 * One table, eighteen seconds, no cuts. The brackets are never unmounted and
 * never re-created: they enter at 0.4s and every position they hold after that
 * is a keyframe here, so the continuity the brief asks for is structural rather
 * than something each act has to remember to honour.
 *
 * Read top to bottom and it is the storyboard:
 *   notice -> hesitate -> lock on the total -> open around the cart -> snap shut
 *   -> carry it -> become a scanner -> sweep -> flatten into the wipe that takes
 *   the world dark -> lock on 87 -> release -> open wide around 25 -> keep
 *   opening until they are the frame the food sits in -> come home -> land on
 *   the wordmark.
 */

/** Where the lockup sits in the final composition. */
export const RESOLVE_WORDMARK = { x: 190, y: 560, width: 700 };

/** The exact rect that reproduces the supplied logo, computed not typed. */
export const RESOLVE_RECT = bracketRectForWordmark(
  RESOLVE_WORDMARK.x,
  RESOLVE_WORDMARK.y,
  RESOLVE_WORDMARK.width,
);

const RECT: RectKey[] = [
  // --- Act 1. Enters low and wide, the way something notices from a distance.
  { f: sec(0.4), v: { x: 706, y: 1548, w: 430, h: 306 } },
  { f: sec(1.0), v: { x: 430, y: 1298, w: 520, h: 344 }, ease: CURVE.inOut },
  // Overshoots the total slightly, then pulls back onto it. This half-second is
  // the whole character: it arrives too fast, registers, and corrects.
  { f: sec(1.42), v: { x: 150, y: 1122, w: 780, h: 196 }, ease: CURVE.out },
  { f: sec(1.62), v: { x: 206, y: 1156, w: 668, h: 132 }, ease: CURVE.snap },
  { f: sec(1.95), v: { x: 176, y: 1140, w: 728, h: 168 }, ease: CURVE.overshoot },

  // --- Act 2. Opens around the whole cart, then shuts on it.
  { f: sec(2.62), v: { x: 96, y: 388, w: 888, h: 978 }, ease: CURVE.inOut },
  { f: sec(3.05), v: { x: 232, y: 726, w: 616, h: 322 }, ease: CURVE.snap },
  { f: sec(3.9), v: { x: 296, y: 566, w: 488, h: 256 }, ease: CURVE.inOut },

  // --- Act 3. Becomes a scanner: wide, tall, travelling down the basket.
  { f: sec(5.0), v: { x: 92, y: 452, w: 896, h: 742 }, ease: CURVE.out },
  { f: sec(6.9), v: { x: 92, y: 690, w: 896, h: 742 }, ease: CURVE.drift },
  // Flattens into a bar. This is the wipe that takes the film dark.
  { f: sec(7.45), v: { x: -60, y: 880, w: 1200, h: 132 }, ease: CURVE.snap },

  // --- Act 4. Small around the old price, then the payoff.
  { f: sec(8.15), v: { x: 366, y: 452, w: 348, h: 150 }, ease: CURVE.out },
  { f: sec(9.0), v: { x: 206, y: 688, w: 668, h: 300 }, ease: CURVE.snap },
  { f: sec(9.7), v: { x: 168, y: 664, w: 744, h: 348 }, ease: CURVE.drift },
  { f: sec(10.2), v: { x: 66, y: 1032, w: 948, h: 560 }, ease: CURVE.overshoot },

  // --- Act 5. Keeps opening until it is the frame the food sits in.
  { f: sec(11.9), v: { x: -70, y: 604, w: 1220, h: 1020 }, ease: CURVE.inOut },
  { f: sec(13.2), v: { x: 86, y: 628, w: 908, h: 912 }, ease: CURVE.drift },

  // --- Act 6. Home.
  { f: sec(14.6), v: { x: 284, y: 992, w: 512, h: 322 }, ease: CURVE.inOut },
  { f: sec(15.5), v: RESOLVE_RECT, ease: CURVE.overshoot },
  { f: sec(18.0), v: RESOLVE_RECT },
];

/** Visibility. They are absent only before they arrive and under the food. */
const OPACITY: Key[] = [
  { f: 0, v: 0 },
  { f: sec(0.4), v: 0 },
  { f: sec(0.75), v: 1 },
  { f: sec(11.9), v: 1 },
  { f: sec(12.3), v: 0.34, ease: CURVE.inOut },
  { f: sec(13.3), v: 0.34 },
  { f: sec(13.9), v: 1, ease: CURVE.out },
  { f: sec(18.0), v: 1 },
];

/**
 * Extra push outward from the rect - the reaction channel.
 *
 * Everything here is a flinch or a release: the recoil at the total, the kick
 * as the cart is captured, the release off 87, and the big opening on 25.
 */
const SPREAD: Key[] = [
  { f: 0, v: 0 },
  { f: sec(1.36), v: 0 },
  { f: sec(1.46), v: 26, ease: CURVE.snap },
  { f: sec(1.72), v: 0, ease: CURVE.out },
  { f: sec(3.0), v: 0 },
  { f: sec(3.12), v: -14, ease: CURVE.snap },
  { f: sec(3.4), v: 0, ease: CURVE.out },
  { f: sec(9.0), v: 0 },
  { f: sec(9.12), v: -12, ease: CURVE.snap },
  { f: sec(9.45), v: 0, ease: CURVE.out },
  { f: sec(10.14), v: 0 },
  { f: sec(10.32), v: 40, ease: CURVE.overshoot },
  { f: sec(10.9), v: 0, ease: CURVE.out },
  { f: sec(18.0), v: 0 },
];

/** Arm length. Long when scanning, logo-exact when resting. */
const REACH: Key[] = [
  { f: 0, v: 1 },
  { f: sec(4.6), v: 1 },
  { f: sec(5.2), v: 1.5, ease: CURVE.out },
  { f: sec(7.3), v: 1.5 },
  { f: sec(7.6), v: 0.9, ease: CURVE.snap },
  { f: sec(10.1), v: 0.9 },
  { f: sec(10.4), v: 1.35, ease: CURVE.overshoot },
  { f: sec(13.2), v: 1.35 },
  { f: sec(15.4), v: 1, ease: CURVE.out },
  { f: sec(18.0), v: 1 },
];

export function brackets(frame: number) {
  return {
    rect: trackRect(frame, RECT),
    opacity: track(frame, OPACITY),
    spread: track(frame, SPREAD),
    reach: track(frame, REACH),
  };
}

/** The ground colour. One dark act, entered by a wipe and left by the food. */
export function groundDark(frame: number): number {
  return track(frame, [
    { f: 0, v: 0 },
    { f: sec(7.3), v: 0 },
    { f: sec(7.55), v: 1, ease: CURVE.snap },
    { f: sec(13.2), v: 1 },
    { f: sec(13.9), v: 0, ease: CURVE.inOut },
    { f: sec(18.0), v: 0 },
  ]);
}
