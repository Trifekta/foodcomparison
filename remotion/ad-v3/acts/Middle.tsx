import React from "react";
import { Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Check } from "lucide-react";
import { CURVE, ramp, track } from "../motion";
import { CART, COMPARISON, COPY, PRICE, sec } from "../spec";
import { FEE_KEETA, FEE_LINES, ITEM_KEETA, ITEM_LINES, byId } from "../elements";

/**
 * "Check first." Punctuation, not a scene.
 *
 * Two thirds of a second. It used to hold for one and a third, which is long
 * enough for the eye to finish reading it, leave, and start waiting - and a beat
 * the audience is waiting through is a beat that has stopped working.
 */
export function CheckFirst() {
  const frame = useCurrentFrame();
  const show = Math.min(ramp(frame, sec(3.06), sec(3.24)), 1 - ramp(frame, sec(3.56), sec(3.74)));
  const rise = (1 - ramp(frame, sec(3.06), sec(3.3), CURVE.out)) * 26;

  return (
    <div
      style={{
        position: "absolute", left: 90, right: 90, top: 1150,
        textAlign: "center", opacity: show, transform: `translateY(${rise}px)`,
      }}
    >
      <p style={{ fontSize: 132, fontWeight: 800, letterSpacing: -5, color: "#12121a" }}>
        {COPY.checkFirst}
      </p>
    </div>
  );
}

/** Where the compressed card sits when it comes apart. Everything starts here. */
const SOURCE = { x: 325, y: 470, w: 430, h: 150 };

/** One piece of the cart, travelling out of the card and into its own place. */
function Piece({
  id,
  outAt,
  children,
}: {
  id: string;
  outAt: number;
  children: React.ReactNode;
}) {
  const frame = useCurrentFrame();
  const g = byId(id);
  const t = ramp(frame, outAt, outAt + 14, CURVE.out);

  const x = interpolate(t, [0, 1], [SOURCE.x, g.rect.x]);
  const y = interpolate(t, [0, 1], [SOURCE.y, g.rect.y]);
  const w = interpolate(t, [0, 1], [SOURCE.w, g.rect.w]);
  const h = interpolate(t, [0, 1], [SOURCE.h, g.rect.h]);

  // Verified when the brackets arrive on it, and it stays verified.
  const seen = ramp(frame, g.visitAt - 2, g.visitAt + 8, CURVE.out);

  return (
    <div
      style={{
        position: "absolute", left: x, top: y, width: w, height: h,
        opacity: t * (0.5 + seen * 0.5),
      }}
    >
      {children}
      <span
        style={{
          position: "absolute", right: -8, top: -8,
          width: 46, height: 46, borderRadius: 999, background: "#FFC61A",
          color: "#12121a", display: "flex", alignItems: "center", justifyContent: "center",
          opacity: seen, transform: `scale(${0.6 + seen * 0.4})`,
        }}
      >
        <Check size={26} strokeWidth={4} />
      </span>
    </div>
  );
}

/** A priced row, with the other app's number arriving beside it. */
function Row({
  name,
  qty,
  price,
  keeta,
  at,
}: {
  name: string;
  qty: number | null;
  price: string;
  keeta: string;
  at: number;
}) {
  const frame = useCurrentFrame();
  const swap = ramp(frame, at, at + 12, CURVE.out);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, height: 104 }}>
      {qty ? (
        <span
          style={{
            width: 40, height: 40, borderRadius: 11, background: "rgba(18,18,26,0.06)",
            fontSize: 24, fontWeight: 800, color: "#55555f",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          {qty}
        </span>
      ) : null}
      <span style={{ fontSize: 32, fontWeight: 600 }}>{name}</span>
      <span
        style={{
          marginLeft: "auto", fontSize: 30, fontWeight: 700,
          fontVariantNumeric: "tabular-nums",
          color: "#9a9aa3", opacity: 1 - swap * 0.55,
          textDecoration: swap > 0.5 ? "line-through" : "none",
        }}
      >
        {price}
      </span>
      <span
        style={{
          width: 132, textAlign: "right", fontSize: 34, fontWeight: 800,
          fontVariantNumeric: "tabular-nums", color: "#12121a",
          opacity: swap, transform: `translateX(${(1 - swap) * 26}px)`,
        }}
      >
        {Number(keeta) === 0 ? "Free" : keeta}
      </span>
    </div>
  );
}

/**
 * The cart, taken apart and checked.
 *
 * The old version of this act was a list that ticked itself off while the
 * brackets drifted past - a dashboard, which is exactly what the brief rules
 * out. Here the compressed card physically comes apart: four objects travel out
 * of it to their own places in the frame, the brackets visit each one in turn,
 * and then the other app's prices arrive next to ours without any of it
 * reassembling into a table.
 */
export function Deconstruct() {
  const frame = useCurrentFrame();
  const show = Math.min(ramp(frame, sec(4.35), sec(4.6)), 1 - ramp(frame, sec(7.3), sec(7.48)));

  const compareAt = sec(6.62);
  const label = ramp(frame, sec(6.5), sec(6.75));

  return (
    <div style={{ position: "absolute", inset: 0, opacity: show }}>
      <Piece id="restaurant" outAt={sec(4.4)}>
        <p style={{ fontSize: 26, fontWeight: 700, letterSpacing: 2.4, color: "#9a9aa3" }}>
          RESTAURANT
        </p>
        <p style={{ fontSize: 62, fontWeight: 800, letterSpacing: -1.8, marginTop: 4 }}>
          {CART.restaurant}
        </p>
        <p style={{ fontSize: 26, fontWeight: 600, color: "#9a9aa3" }}>{CART.meta}</p>
      </Piece>

      <Piece id="items" outAt={sec(4.53)}>
        {ITEM_LINES.map((l, i) => (
          <Row
            key={l.name}
            name={l.name}
            qty={l.qty}
            price={l.price}
            keeta={ITEM_KEETA[i]}
            at={compareAt + i * 3}
          />
        ))}
      </Piece>

      <Piece id="fees" outAt={sec(4.66)}>
        {FEE_LINES.map((l, i) => (
          <Row
            key={l.name}
            name={l.name}
            qty={null}
            price={l.price}
            keeta={FEE_KEETA[i]}
            at={compareAt + 12 + i * 3}
          />
        ))}
      </Piece>

      <Piece id="total" outAt={sec(4.79)}>
        <p style={{ fontSize: 26, fontWeight: 700, letterSpacing: 2.4, color: "#9a9aa3" }}>
          TOTAL
        </p>
        <p
          style={{
            fontSize: 96, fontWeight: 800, letterSpacing: -3, marginTop: 2,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {PRICE.currency} {CART.total}
        </p>
      </Piece>

      {/* The only label in the act. It says what is being done, once. */}
      <p
        style={{
          position: "absolute", left: 96, top: 1810, fontSize: 34, fontWeight: 700,
          letterSpacing: 2, color: "#9a9aa3", opacity: label,
        }}
      >
        {COPY.scanKeeta.toUpperCase()}
      </p>
      <span style={{ display: "none" }}>{COMPARISON.app}</span>
    </div>
  );
}

/**
 * The food, uncovered by the same yellow stroke that framed the saving.
 *
 * A bar travels down the frame and the burger is revealed in its wake. It is
 * the bracket stroke flattened - the same object that has been framing things
 * for eleven seconds, doing one more job - so the food is not a new image that
 * appears, it is what was behind the last one.
 *
 * The image fills the frame and runs off all four edges. A render survives that
 * far better than it survives sitting in the middle of a dark field with its own
 * cut edge visible, which is what it was doing before.
 */
export function Food() {
  const frame = useCurrentFrame();

  const wipe = ramp(frame, sec(11.42), sec(12.02), CURVE.inOut);
  const wipeY = interpolate(wipe, [0, 1], [-140, 2060]);

  const out = 1 - ramp(frame, sec(13.35), sec(13.72));

  // Two speeds, so the frame has depth rather than one flat scale.
  const push = track(frame, [
    { f: sec(11.4), v: 1.26 },
    { f: sec(13.8), v: 1.06, ease: CURVE.drift },
  ]);
  const drift = track(frame, [
    { f: sec(11.4), v: 46 },
    { f: sec(13.8), v: -22, ease: CURVE.drift },
  ]);
  const vignetteDrift = track(frame, [
    { f: sec(11.4), v: -30 },
    { f: sec(13.8), v: 18, ease: CURVE.drift },
  ]);

  const copy = Math.min(ramp(frame, sec(12.3), sec(12.62)), 1 - ramp(frame, sec(13.3), sec(13.6)));

  return (
    <div style={{ position: "absolute", inset: 0, opacity: out, pointerEvents: "none" }}>
      {/* Revealed above the travelling bar. */}
      <div
        style={{
          position: "absolute", inset: 0, overflow: "hidden",
          clipPath: `inset(0 0 ${Math.max(0, 100 - (wipeY / 1920) * 100)}% 0)`,
        }}
      >
        <div style={{ position: "absolute", inset: 0, background: "#0B0A08" }} />
        <Img
          src={staticFile("food/burger.png")}
          style={{
            position: "absolute", left: "50%", top: "50%",
            width: "196%", maxWidth: "none",
            transform: `translate(-50%, calc(-50% + ${drift}px)) scale(${push})`,
            filter: "saturate(1.12) contrast(1.1) brightness(0.97)",
          }}
        />
        <div
          style={{
            position: "absolute", inset: "-12%",
            transform: `translateY(${vignetteDrift}px)`,
            background:
              "radial-gradient(58% 40% at 50% 44%, transparent 30%, rgba(8,6,4,0.62) 74%, rgba(6,4,3,0.94) 100%)",
          }}
        />
        <p
          style={{
            position: "absolute", left: 96, right: 96, bottom: 210,
            fontFamily: "var(--font-serif)", fontSize: 104, lineHeight: 1.0,
            letterSpacing: -1.5, color: "#F7F2E7", whiteSpace: "pre-line",
            opacity: copy, transform: `translateY(${(1 - copy) * 16}px)`,
          }}
        >
          {COPY.foodLine}
        </p>
      </div>

      {/* The bar itself: the bracket stroke, flattened, doing the uncovering. */}
      {wipe > 0 && wipe < 1 ? (
        <div
          style={{
            position: "absolute", left: -40, right: -40, top: wipeY,
            height: 16, background: "#FFC61A",
          }}
        />
      ) : null}
    </div>
  );
}
