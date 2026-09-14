import { Easing, interpolate } from "remotion";

/**
 * The motion vocabulary.
 *
 * V2 ran on springs, and springs are why it reads as a UI rather than as a
 * film: every element arrives with the same bounce regardless of what it
 * weighs or why it moved. This one uses explicit bezier curves and keyframes,
 * so a bracket that hesitates and a number that lands are different gestures
 * rather than the same one at different speeds.
 */

/** Standard curves. Named for what they are for, not for their control points. */
export const CURVE = {
  /** Comes to rest. Most things. */
  out: Easing.bezier(0.16, 1, 0.3, 1),
  /** Leaves and arrives - for something travelling across the frame. */
  inOut: Easing.bezier(0.65, 0, 0.35, 1),
  /** Starts hard, for something reacting rather than being moved. */
  snap: Easing.bezier(0.2, 0, 0, 1),
  /** A small overshoot before settling. Use sparingly: this is personality. */
  overshoot: Easing.bezier(0.34, 1.42, 0.44, 1),
  /** Slow throughout - a drift, not a move. */
  drift: Easing.bezier(0.4, 0, 0.6, 1),
} as const;

export type Key = {
  /** Absolute frame. */
  f: number;
  v: number;
  /** Curve used to reach this key from the previous one. */
  ease?: (t: number) => number;
};

/**
 * Multi-keyframe interpolation of one value over the whole timeline.
 *
 * Holds the first value before the first key and the last after the last, so a
 * track only has to describe the frames it cares about.
 */
export function track(frame: number, keys: Key[]): number {
  if (keys.length === 0) return 0;
  if (frame <= keys[0].f) return keys[0].v;
  const last = keys[keys.length - 1];
  if (frame >= last.f) return last.v;

  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1];
    const b = keys[i];
    if (frame <= b.f) {
      if (b.f === a.f) return b.v;
      return interpolate(frame, [a.f, b.f], [a.v, b.v], {
        easing: b.ease ?? CURVE.out,
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      });
    }
  }
  return last.v;
}

export type Rect = { x: number; y: number; w: number; h: number };
export type RectKey = { f: number; v: Rect; ease?: (t: number) => number };

/** The same, for a rectangle - which is what the bracket frame is. */
export function trackRect(frame: number, keys: RectKey[]): Rect {
  const pick = (k: keyof Rect) =>
    track(frame, keys.map((key) => ({ f: key.f, v: key.v[k], ease: key.ease })));
  return { x: pick("x"), y: pick("y"), w: pick("w"), h: pick("h") };
}

/** 0 to 1 across a window, eased. For opacity and reveals. */
export function ramp(
  frame: number,
  from: number,
  to: number,
  easing: (t: number) => number = CURVE.out,
): number {
  return interpolate(frame, [from, to], [0, 1], {
    easing,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
}

/** Visible between two frames, with eased edges. Layers use this to hand over. */
export function window_(
  frame: number,
  inAt: number,
  inLen: number,
  outAt: number,
  outLen: number,
): number {
  return Math.min(
    ramp(frame, inAt, inAt + inLen),
    1 - ramp(frame, outAt, outAt + outLen),
  );
}
