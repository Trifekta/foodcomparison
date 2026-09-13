import React from "react";
import {
  AbsoluteFill,
  Img,
  OffthreadVideo,
  interpolate,
  random,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { RoomLight, useHandheld } from "./film";
import type { FootagePlate } from "./slots";

/**
 * Plates: the backgrounds a shot is built on.
 *
 * Each one is generated footage when it exists and a drawn stand-in when it does
 * not. The stand-ins are not placeholders - a grey box with a label in it makes
 * a cut impossible to judge, and judging the cut is the entire reason to build
 * the edit before commissioning the footage. So they are lit, they move, and
 * they are the right colour, and the cut can be approved on them.
 *
 * What they cannot be is a person. The two shots that need a face are marked as
 * such in slots.ts, and until footage lands those beats are carried by the phone
 * and the food instead.
 */

/** Out-of-focus practical lights. The cheapest depth in a night interior. */
function Bokeh({ count = 9, seed = "b" }: { count?: number; seed?: string }) {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill aria-hidden="true" style={{ pointerEvents: "none" }}>
      {Array.from({ length: count }).map((_, i) => {
        const size = 40 + random(`${seed}s${i}`) * 150;
        const left = random(`${seed}x${i}`) * 100;
        const top = random(`${seed}y${i}`) * 80;
        const drift = Math.sin(frame / (70 + i * 11)) * 14;
        const warm = random(`${seed}w${i}`) > 0.35;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: `${left}%`,
              top: `${top}%`,
              width: size,
              height: size,
              borderRadius: "50%",
              background: warm
                ? "radial-gradient(circle, rgba(255,196,120,0.50), rgba(255,170,80,0) 68%)"
                : "radial-gradient(circle, rgba(150,200,255,0.34), rgba(120,170,255,0) 68%)",
              filter: `blur(${size * 0.14}px)`,
              transform: `translateY(${drift}px)`,
              opacity: 0.28 + random(`${seed}o${i}`) * 0.4,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
}

/**
 * A dark apartment at night.
 *
 * Built the way the room would be lit rather than the way a gradient is made:
 * one warm practical off to one side, a cool spill where the phone is, an
 * unlit foreground mass reading as the back of a sofa, and everything else
 * falling away. The handheld drift is what stops it being wallpaper.
 */
export function NightApartment({ intensity = 1 }: { intensity?: number }) {
  const hand = useHandheld(0.6);

  return (
    <AbsoluteFill style={{ background: "#08090e", overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          transform: `translate(${hand.x}px, ${hand.y}px) scale(1.06) rotate(${hand.rotate}deg)`,
        }}
      >
        {/* Wall, and the floor line that gives the room a depth cue. */}
        <AbsoluteFill
          style={{
            background:
              "linear-gradient(178deg, #14151d 0%, #0c0d13 46%, #090a0f 62%, #0b0c12 100%)",
          }}
        />

        <Bokeh count={10} seed="room" />
        <RoomLight
          warm={`rgba(255,178,88,${0.34 * intensity})`}
          cool={`rgba(140,190,255,${0.14 * intensity})`}
        />

        {/* Foreground mass: the unlit back of a sofa, cutting the bottom third.
            Blurred hard, because anything this close to a lens is not in focus. */}
        <div
          style={{
            position: "absolute",
            left: "-12%",
            right: "-12%",
            bottom: "-16%",
            height: "46%",
            borderRadius: "46% 54% 0 0 / 22% 20% 0 0",
            background: "linear-gradient(180deg, #0a0b10 0%, #050609 100%)",
            filter: "blur(14px)",
          }}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

/**
 * A hand, as a silhouette.
 *
 * Deliberately a shape and not an illustration. The failure mode of generated
 * hands is well known and universally noticed, and the failure mode of a drawn
 * one is that it looks drawn - but a dark shape moving into a dark frame in
 * front of a bright screen is what a hand actually looks like in this lighting,
 * and it cannot have six fingers.
 */
export function ThumbSilhouette({ progress = 0 }: { progress?: number }) {
  const y = interpolate(progress, [0, 1], [420, 60], { extrapolateRight: "clamp" });
  const rotate = interpolate(progress, [0, 1], [16, 4], { extrapolateRight: "clamp" });

  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        right: "16%",
        bottom: 0,
        width: 300,
        height: 560,
        transform: `translateY(${y}px) rotate(${rotate}deg)`,
        transformOrigin: "bottom center",
        borderRadius: "50% 50% 22% 22% / 38% 38% 10% 10%",
        background: "linear-gradient(180deg, #101119 0%, #06070b 60%)",
        filter: "blur(3px)",
        opacity: 0.97,
      }}
    />
  );
}

/**
 * Food, close, warm and shallow.
 *
 * The repo's own renders on a dark ground with a rim light behind them and a
 * little steam. They are 2000px-plus artwork, so they hold up filling a 1080
 * frame, which is the whole reason this shot can exist without footage.
 */
export function FoodMacro({
  asset = "food/burger.png",
  push = 1,
}: {
  asset?: string;
  push?: number;
}) {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ background: "#0c0704", overflow: "hidden" }}>
      {/* Warm key from behind and above, the way a hot dish is always lit. */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(58% 40% at 50% 26%, rgba(255,186,92,0.55) 0%, rgba(150,70,12,0.22) 44%, transparent 72%)",
        }}
      />

      {/*
        The food, filling the frame.
        The first cut sized this to 128% and centred it, which left the render
        sitting in the middle of a black field with its own edges visible - a
        cutout, not a close-up. A macro shot is called that because the subject
        runs out of frame: it is scaled past the edges and pushed down so the
        crop lands through the middle of the food.
      */}
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
        <Img
          src={staticFile(asset)}
          style={{
            width: "205%",
            maxWidth: "none",
            transform: `scale(${push}) translateY(4%)`,
            filter: "saturate(1.18) contrast(1.12) brightness(1.02)",
          }}
        />
      </AbsoluteFill>

      {/* Steam, in front of the food rather than behind it. */}
      <AbsoluteFill aria-hidden="true">
        {Array.from({ length: 6 }).map((_, i) => {
          const rise = ((frame * (1.1 + i * 0.19) + i * 74) % 300) / 300;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: `${22 + i * 11}%`,
                top: `${58 - rise * 46}%`,
                width: 150 + i * 26,
                height: 260,
                borderRadius: "50%",
                background:
                  "radial-gradient(circle, rgba(255,244,228,0.20), transparent 64%)",
                filter: "blur(30px)",
                opacity: (1 - rise) * rise * 3.1,
                transform: `translateX(${Math.sin(frame / 26 + i * 1.7) * 26}px)`,
              }}
            />
          );
        })}
      </AbsoluteFill>

      {/* Hard falloff. A fast lens at this distance holds almost nothing. */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(64% 38% at 50% 52%, transparent 30%, rgba(10,6,3,0.55) 72%, rgba(8,5,3,0.92) 100%)",
        }}
      />
    </AbsoluteFill>
  );
}

/**
 * Renders a plate: the generated clip if the slot has one, the drawn stand-in
 * otherwise. Every shot in the ad goes through here, so swapping a stand-in for
 * footage is one string in slots.ts and never a change to a scene.
 */
export function Plate({
  slot,
  children,
}: {
  slot: FootagePlate;
  children?: React.ReactNode;
}) {
  if (slot.src) {
    return (
      <AbsoluteFill>
        <OffthreadVideo
          src={staticFile(slot.src)}
          trimBefore={slot.trimBefore}
          trimAfter={slot.trimAfter}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          muted
        />
      </AbsoluteFill>
    );
  }

  return <AbsoluteFill>{children}</AbsoluteFill>;
}
