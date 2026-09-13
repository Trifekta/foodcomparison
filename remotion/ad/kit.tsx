import React from "react";
import {
  AbsoluteFill,
  Img,
  OffthreadVideo,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { cn } from "@/lib/utils/cn";
import type { FootageSlot } from "./slots";

/**
 * The motion vocabulary the whole ad is built from.
 *
 * The reference we are working from has exactly one move - things arrive on a
 * spring, sit still, and cut. No crossfades, no drifting, nothing easing out.
 * That restraint is most of why it reads as design rather than as a slideshow,
 * so the primitives here only do the one move, and scenes compose them instead
 * of writing their own interpolations.
 */

/** Entrance spring, 0 to 1, optionally delayed. Stiff and barely bouncy. */
export function useEntrance(delayInFrames = 0): number {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return spring({
    frame: frame - delayInFrames,
    fps,
    config: { damping: 26, stiffness: 140, mass: 0.7 },
    durationInFrames: 22,
  });
}

/**
 * Fades and lifts its children in on the entrance spring.
 *
 * `distance` is how far below the resting position the element starts. Negative
 * values drop it in from above, which is what the screenshot does in the upload
 * beat.
 */
export function RiseIn({
  children,
  delay = 0,
  distance = 42,
  className,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  distance?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const progress = useEntrance(delay);

  return (
    <div
      className={className}
      style={{
        ...style,
        opacity: progress,
        transform: `translateY(${(1 - progress) * distance}px)`,
      }}
    >
      {children}
    </div>
  );
}

/** Same entrance, scaled up from small rather than lifted. For marks and cards. */
export function PopIn({
  children,
  delay = 0,
  from = 0.86,
  className,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  from?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const progress = useEntrance(delay);

  return (
    <div
      className={className}
      style={{
        ...style,
        opacity: progress,
        transform: `scale(${interpolate(progress, [0, 1], [from, 1])})`,
      }}
    >
      {children}
    </div>
  );
}

/**
 * Type that arrives a character at a time.
 *
 * Spaces are rendered as non-breaking so a staggered line keeps its word gaps,
 * and each character is inline-block because a transform does nothing to an
 * inline box.
 */
export function KineticText({
  children,
  delay = 0,
  stagger = 1.6,
  className,
}: {
  children: string;
  delay?: number;
  stagger?: number;
  className?: string;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <span className={className}>
      {children.split("").map((character, index) => {
        const progress = spring({
          frame: frame - delay - index * stagger,
          fps,
          config: { damping: 24, stiffness: 150, mass: 0.6 },
          durationInFrames: 20,
        });

        return (
          <span
            // Characters repeat within a line, so the index is the identity here.
            key={index}
            style={{
              display: "inline-block",
              opacity: progress,
              transform: `translateY(${(1 - progress) * 0.3}em)`,
            }}
          >
            {character === " " ? " " : character}
          </span>
        );
      })}
    </span>
  );
}

/**
 * The dotted construction circles and crosshairs.
 *
 * Straight out of the reference, and the single cheapest thing in it: two thin
 * dotted rings and a pair of guide lines turn a logo sitting on a background
 * into a logo being drawn. They are decoration, so they sit behind everything
 * and never carry meaning.
 */
export function Guides({
  delay = 0,
  size = 520,
  className,
}: {
  delay?: number;
  size?: number;
  className?: string;
}) {
  const frame = useCurrentFrame();
  const progress = useEntrance(delay);
  const radius = size / 2;
  const offset = size * 0.19;

  return (
    <AbsoluteFill
      className={cn("items-center justify-center", className)}
      style={{ opacity: progress * 0.55 }}
      aria-hidden="true"
    >
      <svg
        width={size * 1.6}
        height={size * 1.15}
        viewBox={`0 0 ${size * 1.6} ${size * 1.15}`}
        style={{
          transform: `scale(${interpolate(progress, [0, 1], [0.9, 1])}) rotate(${
            frame * 0.06
          }deg)`,
        }}
      >
        <g
          fill="none"
          stroke="var(--color-ink-400)"
          strokeWidth={2}
          strokeDasharray="3 13"
          strokeLinecap="round"
        >
          <circle cx={size * 0.8 - offset} cy={size * 0.575} r={radius * 0.92} />
          <circle cx={size * 0.8 + offset} cy={size * 0.575} r={radius * 0.92} />
        </g>
      </svg>
    </AbsoluteFill>
  );
}

/**
 * Horizontal guide lines that extend across the frame.
 *
 * Separate from the circles because they are timed separately in the reference:
 * the rings settle first, the rules draw through afterwards.
 */
export function GuideRules({
  delay = 0,
  gap = 190,
}: {
  delay?: number;
  gap?: number;
}) {
  const frame = useCurrentFrame();
  const width = interpolate(frame - delay, [0, 26], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill className="items-center justify-center" aria-hidden="true">
      <div className="relative w-full">
        {[-gap, gap].map((y) => (
          <div
            key={y}
            className="absolute left-1/2 h-px -translate-x-1/2 bg-ink-300"
            style={{ top: y, width: `${width}%`, opacity: 0.7 }}
          />
        ))}
      </div>
    </AbsoluteFill>
  );
}

/**
 * The four corner brackets from the wordmark, drawn at any size.
 *
 * This is the product's one real motif - it says "screenshot" without a word,
 * which is the thing a customer has to understand before anything else works -
 * so the ad uses it wherever something is being captured rather than inventing
 * a second visual idea.
 */
export function CropFrame({
  children,
  progress = 1,
  arm = 46,
  thickness = 6,
  className,
}: {
  children?: React.ReactNode;
  progress?: number;
  arm?: number;
  thickness?: number;
  className?: string;
}) {
  const corners = [
    { top: 0, left: 0, borderTop: true, borderLeft: true, radius: "16px 0 0 0" },
    { top: 0, right: 0, borderTop: true, borderRight: true, radius: "0 16px 0 0" },
    { bottom: 0, left: 0, borderBottom: true, borderLeft: true, radius: "0 0 0 16px" },
    { bottom: 0, right: 0, borderBottom: true, borderRight: true, radius: "0 0 16px 0" },
  ] as const;

  return (
    <div className={cn("relative", className)}>
      {children}
      {corners.map((corner, index) => (
        <div
          key={index}
          aria-hidden="true"
          className="pointer-events-none absolute"
          style={{
            top: "top" in corner ? corner.top : undefined,
            bottom: "bottom" in corner ? corner.bottom : undefined,
            left: "left" in corner ? corner.left : undefined,
            right: "right" in corner ? corner.right : undefined,
            width: arm * progress,
            height: arm * progress,
            borderColor: "var(--color-brand-500)",
            borderTopWidth: "borderTop" in corner ? thickness : 0,
            borderBottomWidth: "borderBottom" in corner ? thickness : 0,
            borderLeftWidth: "borderLeft" in corner ? thickness : 0,
            borderRightWidth: "borderRight" in corner ? thickness : 0,
            borderRadius: corner.radius,
            opacity: progress,
          }}
        />
      ))}
    </div>
  );
}

/**
 * A card on the warm ground: hairline border, soft radius, no heavy shadow.
 *
 * The two looks are a prop rather than something a caller layers on with extra
 * classes. `cn` is a plain joiner - the project says so in its own comment - so
 * a caller passing `bg-chip-green-bg` alongside a built-in `bg-white` does not
 * win by being later in the string; it wins or loses on the order Tailwind
 * happened to emit the two rules, which is a coin flip that renders silently.
 * Resolving the tone here keeps exactly one background and one border in play.
 */
export function Card({
  children,
  tone = "plain",
  className,
  style,
}: {
  children: React.ReactNode;
  tone?: "plain" | "highlight";
  className?: string;
  style?: React.CSSProperties;
}) {
  const TONES = {
    plain: "border border-ink-200/80 bg-white",
    highlight: "border-[3px] border-chip-green-fg bg-chip-green-bg",
  } as const;

  return (
    <div className={cn("rounded-[28px]", TONES[tone], className)} style={style}>
      {children}
    </div>
  );
}

/**
 * A footage slot: generated video once it exists, and until then the still the
 * slot names, given a slow push so the beat is never actually frozen.
 *
 * The push is applied to the still only. Generated clips already carry their
 * own camera move, and pushing on top of that is how a shot ends up looking
 * like a screensaver.
 */
export function Footage({
  slot,
  className,
}: {
  slot: FootageSlot;
  className?: string;
}) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  if (slot.src) {
    return (
      <OffthreadVideo
        src={staticFile(slot.src)}
        trimBefore={slot.trimBefore}
        trimAfter={slot.trimAfter}
        className={cn("h-full w-full object-cover", className)}
        muted
      />
    );
  }

  const push = interpolate(frame, [0, durationInFrames], [1.04, 1.13]);

  return (
    <Img
      src={staticFile(slot.fallback)}
      className={cn("h-full w-full object-contain", className)}
      style={{ transform: `scale(${push})` }}
    />
  );
}

/** Centres a scene's content and gives every scene the same margins. */
export function Stage({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <AbsoluteFill
      className={cn(
        "items-center justify-center bg-canvas px-[140px] text-ink-900",
        className,
      )}
    >
      {children}
    </AbsoluteFill>
  );
}

/** The small caption that labels a beat, set in the product's slate body tone. */
export function Caption({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <RiseIn delay={delay} distance={18}>
      <p
        className={cn(
          "text-center text-[38px] font-semibold text-slate-600",
          className,
        )}
      >
        {children}
      </p>
    </RiseIn>
  );
}
