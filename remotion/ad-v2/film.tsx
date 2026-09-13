import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  random,
  useCurrentFrame,
} from "remotion";

/**
 * The treatment layer - the things that separate footage from a slide.
 *
 * None of this is animation in the motion-graphics sense. It is grain, falloff,
 * a lens that is never perfectly still and light that spills where light would
 * spill. Applied over the whole frame at the very end, it is most of the
 * difference between "rendered in a browser" and "shot".
 */

/**
 * Film grain.
 *
 * A tiled noise bitmap offset by a new random amount every frame, rather than an
 * feTurbulence filter evaluated over two million pixels thirty times a second.
 * The cheap version is indistinguishable at this size and renders in about a
 * thousandth of the time.
 */
const NOISE_TILE =
  "data:image/svg+xml;base64," +
  btoaSafe(
    `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180">` +
      `<filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch"/>` +
      `<feColorMatrix type="saturate" values="0"/></filter>` +
      `<rect width="180" height="180" filter="url(#n)" opacity="0.55"/></svg>`,
  );

/** btoa is not defined during SSR of the bundle; this keeps the module portable. */
function btoaSafe(input: string): string {
  if (typeof btoa === "function") return btoa(input);
  return Buffer.from(input, "binary").toString("base64");
}

export function Grain({ opacity = 0.07 }: { opacity?: number }) {
  const frame = useCurrentFrame();
  const x = Math.round(random(`gx${frame}`) * 180);
  const y = Math.round(random(`gy${frame}`) * 180);

  return (
    <AbsoluteFill
      aria-hidden="true"
      style={{
        backgroundImage: `url("${NOISE_TILE}")`,
        backgroundPosition: `${x}px ${y}px`,
        mixBlendMode: "overlay",
        opacity,
        pointerEvents: "none",
      }}
    />
  );
}

/** Light falls off towards the edges of a lens. Flat frames read as diagrams. */
export function Vignette({ strength = 0.55 }: { strength?: number }) {
  return (
    <AbsoluteFill
      aria-hidden="true"
      style={{
        background: `radial-gradient(120% 75% at 50% 42%, transparent 38%, rgba(6,5,10,${strength}) 100%)`,
        pointerEvents: "none",
      }}
    />
  );
}

/**
 * A cut that lands on a beat gets a single frame of lift rather than a
 * transition. Two frames of slightly raised exposure reads as an edit with
 * energy behind it; a cross-dissolve reads as a slideshow.
 */
export function BeatFlash({ at, strength = 0.5 }: { at: number; strength?: number }) {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame - at, [0, 1, 5], [0, strength, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  if (opacity <= 0) return null;

  return (
    <AbsoluteFill
      aria-hidden="true"
      style={{ background: "#fff6de", opacity, mixBlendMode: "screen" }}
    />
  );
}

/**
 * A slow push, in percent of scale across the shot.
 *
 * Every plate in this ad moves. A locked-off frame in a performance ad reads as
 * a still somebody forgot to animate, and the eye leaves.
 */
export function useCameraPush({
  from = 1.0,
  to = 1.08,
  durationInFrames,
}: {
  from?: number;
  to?: number;
  durationInFrames: number;
}): number {
  const frame = useCurrentFrame();
  return interpolate(frame, [0, durationInFrames], [from, to], {
    extrapolateRight: "clamp",
  });
}

/**
 * Handheld: a small, slow, irregular drift.
 *
 * Built from two out-of-phase sines rather than random(), because real handheld
 * wanders and never jitters - per-frame noise reads as a camera being shaken,
 * which is a different and much cheaper-looking thing.
 */
export function useHandheld(amount = 1): { x: number; y: number; rotate: number } {
  const frame = useCurrentFrame();
  return {
    x: Math.sin(frame / 37) * 6 * amount + Math.sin(frame / 13) * 2 * amount,
    y: Math.cos(frame / 43) * 5 * amount + Math.cos(frame / 17) * 1.5 * amount,
    rotate: Math.sin(frame / 61) * 0.25 * amount,
  };
}

/**
 * Speed-ramped entrance for a cut: the shot arrives fast and settles.
 *
 * Returns 0..1 with a hard ease-out, the curve an editor reaches for on the
 * first frames of a new shot so it lands rather than slides.
 */
export function useShotIn(durationInFrames = 12): number {
  const frame = useCurrentFrame();
  return interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
}

/**
 * Warm practical light spilling from somewhere off-frame, and the cool pool a
 * phone throws on whatever is holding it. Together they are the entire lighting
 * plan of a night interior, and the reason the fallback plates read as a room.
 */
export function RoomLight({
  warm = "rgba(255,186,92,0.30)",
  cool = "rgba(150,200,255,0.16)",
}: {
  warm?: string;
  cool?: string;
}) {
  return (
    <AbsoluteFill aria-hidden="true" style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(58% 34% at 82% 16%, ${warm} 0%, transparent 62%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(46% 28% at 30% 62%, ${cool} 0%, transparent 68%)`,
        }}
      />
    </AbsoluteFill>
  );
}

/** The whole treatment stack, applied once at the top of the composition. */
export function FilmLook({
  grain = 0.07,
  vignette = 0.55,
}: {
  grain?: number;
  vignette?: number;
}) {
  return (
    <>
      <Vignette strength={vignette} />
      <Grain opacity={grain} />
    </>
  );
}
