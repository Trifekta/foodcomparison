import React from "react";

/**
 * The phone, and the maths for putting our interface onto somebody else's.
 *
 * Two jobs live here. `Phone` draws a device, used wherever the shot is built
 * rather than filmed. `screenTransform` corner-pins a flat interface onto the
 * four corners of a screen in footage, which is how the real SnipSavor UI gets
 * into a generated shot of a person holding a phone.
 *
 * The second one matters more than it looks. Generative video cannot be trusted
 * with a price, a logo or an interface, so the phone in any generated plate has
 * to be treated as a green screen: track its four corners, throw away whatever
 * the model invented on the glass, and composite the real thing in its place.
 */

/** A point in the plate, in pixels. */
export type Corner = { x: number; y: number };

/** Screen corners in footage, clockwise from top-left. */
export type ScreenQuad = {
  topLeft: Corner;
  topRight: Corner;
  bottomRight: Corner;
  bottomLeft: Corner;
};

/**
 * Solves the 8x8 system for the homography taking a `width` x `height`
 * rectangle onto four arbitrary points, and returns it as a CSS matrix3d.
 *
 * Plain Gaussian elimination with partial pivoting. Eight unknowns is small
 * enough that nothing cleverer is worth the dependency.
 */
export function screenTransform(
  width: number,
  height: number,
  quad: ScreenQuad,
): string {
  const source: Corner[] = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ];
  const target = [quad.topLeft, quad.topRight, quad.bottomRight, quad.bottomLeft];

  // Two rows per correspondence: one for x, one for y.
  const a: number[][] = [];
  const b: number[] = [];

  for (let i = 0; i < 4; i++) {
    const { x: u, y: v } = source[i];
    const { x, y } = target[i];
    a.push([u, v, 1, 0, 0, 0, -u * x, -v * x]);
    b.push(x);
    a.push([0, 0, 0, u, v, 1, -u * y, -v * y]);
    b.push(y);
  }

  const h = solve(a, b);
  if (!h) return "none";

  const [h11, h12, h13, h21, h22, h23, h31, h32] = h;

  // CSS matrix3d is column-major, and the z row is left as identity.
  return `matrix3d(${h11}, ${h21}, 0, ${h31}, ${h12}, ${h22}, 0, ${h32}, 0, 0, 1, 0, ${h13}, ${h23}, 0, 1)`;
}

function solve(a: number[][], b: number[]): number[] | null {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(m[row][col]) > Math.abs(m[pivot][col])) pivot = row;
    }
    if (Math.abs(m[pivot][col]) < 1e-10) return null;
    [m[col], m[pivot]] = [m[pivot], m[col]];

    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = m[row][col] / m[col][col];
      for (let k = col; k <= n; k++) m[row][k] -= factor * m[col][k];
    }
  }

  // Fully reduced, so each row is now (diagonal) * x = rhs.
  return m.map((row, i) => row[n] / row[i]);
}

/**
 * A phone, drawn.
 *
 * Deliberately plain - a dark slab, a thin bezel and one specular streak across
 * the glass. The screen is the only bright thing in the shot, which is both how
 * a phone actually looks in a dark room and where the ad wants the eye.
 */
export function Phone({
  children,
  width = 520,
  glow = "rgba(140,190,255,0.42)",
  screenWidth = 390,
  screenHeight = 844,
  style,
}: {
  children: React.ReactNode;
  width?: number;
  glow?: string;
  /** Logical size the screen content is authored at. */
  screenWidth?: number;
  screenHeight?: number;
  style?: React.CSSProperties;
}) {
  // 19.5:9, the shape of every phone the audience owns.
  const height = width * (19.5 / 9);
  const bezel = width * 0.022;
  const radius = width * 0.115;

  // The screen content is authored at device size and scaled to the glass here,
  // rather than each caller typing a factor.
  //
  // Hand-computed factors were how the first cut ended up with the cart total
  // clipped off the bottom of one shot and a band of empty white at the bottom
  // of two others: every one of them was right for the width and wrong for the
  // height, and the error is invisible in the code and obvious in the render.
  const inner = { w: width - bezel * 2, h: height - bezel * 2 };
  const scale = Math.min(inner.w / screenWidth, inner.h / screenHeight);

  return (
    <div
      style={{
        position: "relative",
        width,
        height,
        borderRadius: radius,
        background: "linear-gradient(160deg, #23242a 0%, #101115 45%, #1b1c22 100%)",
        padding: bezel,
        boxSizing: "border-box",
        // The device edge catches the room, and the screen throws light outward.
        boxShadow: `0 0 0 ${width * 0.004}px rgba(255,255,255,0.09), 0 ${width * 0.06}px ${width * 0.16}px rgba(0,0,0,0.65), 0 0 ${width * 0.4}px ${glow}`,
        ...style,
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          borderRadius: radius - bezel * 0.7,
          overflow: "hidden",
          background: "#0c0c10",
        }}
      >
        <div
          style={{
            width: screenWidth,
            height: screenHeight,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          {children}
        </div>

        {/* Glass. A single soft diagonal highlight - two or more reads as plastic. */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(118deg, rgba(255,255,255,0.13) 0%, rgba(255,255,255,0.04) 22%, transparent 44%)",
            pointerEvents: "none",
          }}
        />
      </div>
    </div>
  );
}

/**
 * Places flat interface content onto a screen quad in a plate.
 *
 * Used once real footage exists: give it the pixel corners of the phone screen
 * in the shot and it renders the UI at its own resolution, corner-pinned into
 * the frame. Until then nothing calls it, and `Phone` above draws the device
 * instead.
 */
export function ScreenComposite({
  children,
  screenWidth,
  screenHeight,
  quad,
  opacity = 1,
}: {
  children: React.ReactNode;
  screenWidth: number;
  screenHeight: number;
  quad: ScreenQuad;
  opacity?: number;
}) {
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: screenWidth,
        height: screenHeight,
        transform: screenTransform(screenWidth, screenHeight, quad),
        transformOrigin: "0 0",
        overflow: "hidden",
        opacity,
      }}
    >
      {children}
    </div>
  );
}
