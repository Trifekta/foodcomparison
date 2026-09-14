import React from "react";
import { Img, staticFile } from "remotion";
import type { Rect } from "./motion";

/**
 * The logo, and the brackets that come out of it.
 *
 * The supplied logo is a raster asset and the source of truth. It is used
 * directly in two forms, both extracted from it rather than redrawn:
 * `logo-wordmark.png` is the lockup with the ring and the four brackets keyed
 * out, and `logo-circle.png` is the full circular treatment.
 *
 * The brackets cannot be an image, because they are the protagonist and have to
 * move independently for eighteen seconds. So they are drawn - but every
 * proportion below was measured off the supplied file rather than chosen, which
 * is what lets the last shot work: the brackets travel home, land on the numbers
 * in LOGO, and at that moment the drawn brackets and the extracted wordmark are
 * the logo, not an approximation of it.
 */

/** Measured from the supplied asset. Frame = the crop marks around "Snip". */
export const LOGO = {
  /** Source bracket frame, in the asset's own pixels. */
  frame: { w: 461, h: 333 },
  /** Arm length as a fraction of the frame. */
  armW: 0.20119,
  armH: 0.247,
  /** Stroke weight as a fraction of frame width. */
  thickness: 0.04447,
  /** The wordmark's box, expressed in frame units. */
  wordmark: { x: 0.05423, y: 0.15015, w: 2.24295, h: 0.74474 },
  /** Extracted wordmark PNG, in pixels. */
  wordmarkPng: { w: 1034, h: 248 },
  /** The trimmed circular treatment, and where the wordmark sits inside it. */
  circlePng: { w: 1243, h: 1235 },
  wordmarkInCircle: { x: 132, y: 509, w: 1034, h: 248 },
} as const;

export const WORDMARK_ASPECT = LOGO.wordmarkPng.h / LOGO.wordmarkPng.w;

/**
 * Given where the wordmark is drawn, where its brackets belong.
 *
 * The inverse of the measurement above. Call it with the wordmark's on-screen
 * box and the brackets land exactly where the supplied logo puts them.
 */
export function bracketRectForWordmark(x: number, y: number, width: number): Rect {
  const height = width * WORDMARK_ASPECT;
  const w = width / LOGO.wordmark.w;
  const h = height / LOGO.wordmark.h;
  return {
    x: x - LOGO.wordmark.x * w,
    y: y - LOGO.wordmark.y * h,
    w,
    h,
  };
}

/**
 * Where to draw the circular treatment so that the wordmark inside it lands
 * exactly on top of the one already on screen.
 *
 * This is what makes the ending work: the ring does not arrive as a new object
 * that the lockup has to make room for. The drawn brackets and the extracted
 * wordmark cross-fade into the full asset while every pixel stays put, so what
 * the viewer sees is a circle closing around a mark that never moved.
 */
export function circleForWordmark(x: number, y: number, width: number) {
  const scale = width / LOGO.wordmarkInCircle.w;
  return {
    x: x - LOGO.wordmarkInCircle.x * scale,
    y: y - LOGO.wordmarkInCircle.y * scale,
    width: LOGO.circlePng.w * scale,
  };
}

export const BRAND_YELLOW = "#FFC61A";

/**
 * The four scan brackets.
 *
 * `spread` pushes all four corners outward from the rect - the gesture for
 * recoiling, releasing, or reacting - without changing what they are framing.
 * `reach` scales the arm length, so they can go from a tight lock to a wide
 * open reticle.
 */
export function Brackets({
  rect,
  opacity = 1,
  spread = 0,
  reach = 1,
  color = BRAND_YELLOW,
  blur = 0,
}: {
  rect: Rect;
  opacity?: number;
  spread?: number;
  reach?: number;
  color?: string;
  blur?: number;
}) {
  const x = rect.x - spread;
  const y = rect.y - spread;
  const w = rect.w + spread * 2;
  const h = rect.h + spread * 2;

  // Stroke stays in a sane range on screen but resolves to the logo's own
  // proportion at the size the lockup is drawn, which is the size that matters.
  const t = Math.max(9, Math.min(22, LOGO.thickness * w));
  const armW = Math.min(w / 2 - t, LOGO.armW * w * reach);
  const armH = Math.min(h / 2 - t, LOGO.armH * h * reach);
  const r = t * 0.9;

  const corners = [
    { left: 0, top: 0, bt: true, bl: true, radius: `${r}px 0 0 0` },
    { right: 0, top: 0, bt: true, br: true, radius: `0 ${r}px 0 0` },
    { left: 0, bottom: 0, bb: true, bl: true, radius: `0 0 0 ${r}px` },
    { right: 0, bottom: 0, bb: true, br: true, radius: `0 0 ${r}px 0` },
  ] as const;

  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        opacity,
        filter: blur ? `blur(${blur}px)` : undefined,
        pointerEvents: "none",
      }}
    >
      {corners.map((c, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: "left" in c ? c.left : undefined,
            right: "right" in c ? c.right : undefined,
            top: "top" in c ? c.top : undefined,
            bottom: "bottom" in c ? c.bottom : undefined,
            width: armW,
            height: armH,
            borderColor: color,
            borderTopWidth: "bt" in c ? t : 0,
            borderBottomWidth: "bb" in c ? t : 0,
            borderLeftWidth: "bl" in c ? t : 0,
            borderRightWidth: "br" in c ? t : 0,
            borderStyle: "solid",
            borderRadius: c.radius,
            boxSizing: "border-box",
          }}
        />
      ))}
    </div>
  );
}

/** The supplied lockup, ring and brackets keyed out. */
export function Wordmark({
  x,
  y,
  width,
  opacity = 1,
}: {
  x: number;
  y: number;
  width: number;
  opacity?: number;
}) {
  return (
    <Img
      src={staticFile("brand/logo-wordmark.png")}
      style={{
        position: "absolute",
        left: x,
        top: y,
        width,
        height: width * WORDMARK_ASPECT,
        opacity,
      }}
    />
  );
}

/** The full circular treatment. Used once, at the very end. */
export function LogoCircle({
  x,
  y,
  width,
  opacity = 1,
}: {
  x: number;
  y: number;
  width: number;
  opacity?: number;
}) {
  return (
    <Img
      src={staticFile("brand/logo-circle.png")}
      style={{
        position: "absolute",
        left: x,
        top: y,
        width,
        height: width * (LOGO.circlePng.h / LOGO.circlePng.w),
        opacity,
      }}
    />
  );
}
