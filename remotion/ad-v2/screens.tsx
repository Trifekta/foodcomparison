import React from "react";
import { Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Check, Search } from "lucide-react";
import { CART, COMPARISON, COPY, PRICE } from "./spec";

/**
 * What is actually on the glass.
 *
 * Every screen here is drawn at a logical 390x844 - the size of the phone the
 * audience is holding - and scaled into whatever the shot needs. Designing at
 * device size rather than at video size means the type sits at the weights a
 * real interface uses, which is most of why a composited screen reads as a
 * screen rather than as a diagram of one.
 *
 * The delivery app is deliberately generic: a neutral charcoal interface with no
 * borrowed logo, colour or layout. The ad's claim is about price, and dressing
 * the "before" screen as a named competitor turns a price comparison into a
 * passing-off problem for nothing in return.
 */

export const SCREEN_W = 390;
export const SCREEN_H = 844;

function Frame({
  children,
  background = "#ffffff",
}: {
  children: React.ReactNode;
  background?: string;
}) {
  return (
    <div
      style={{
        width: SCREEN_W,
        height: SCREEN_H,
        background,
        fontFamily: "var(--font-sans)",
        color: "#12121a",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {children}
    </div>
  );
}

/** The status bar. Tiny, and its absence is instantly noticeable. */
function StatusBar({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const color = tone === "dark" ? "#12121a" : "#ffffff";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "14px 26px 6px",
        color,
        fontSize: 15,
        fontWeight: 700,
      }}
    >
      <span>9:41</span>
      <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
        <div style={{ width: 17, height: 11, borderRadius: 2, background: color, opacity: 0.9 }} />
        <div style={{ width: 15, height: 11, borderRadius: 2, background: color, opacity: 0.6 }} />
        <div style={{ width: 24, height: 12, borderRadius: 3, border: `1.5px solid ${color}`, opacity: 0.9 }} />
      </div>
    </div>
  );
}

/**
 * The cart, in the app the customer is already in.
 *
 * Six lines that add to 112, because the number has to survive being read. A
 * viewer who totals two mains, two sides, two drinks and fees and gets the
 * headline figure believes the rest of the ad; one who sees a burger and a Coke
 * at a hundred and twelve dirhams has already decided it is made up.
 */
export function CartScreen({ highlightTotal = 0 }: { highlightTotal?: number }) {
  return (
    <Frame background="#f4f4f6">
      <StatusBar />

      <div style={{ padding: "10px 24px 4px" }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "#8a8a96", letterSpacing: 0.6 }}>
          YOUR ORDER
        </p>
        <p style={{ fontSize: 25, fontWeight: 800, letterSpacing: -0.5, marginTop: 3 }}>
          {CART.restaurant}
        </p>
      </div>

      {/*
        The list hugs its contents instead of stretching.

        A real cart pins its total and CTA to the bottom of the screen, and with
        flex:1 here that is what this did - which put the total at the very
        bottom of a 19.5:9 screen, and therefore at or below the bottom edge of
        the frame in every shot the phone appears in. The total is the entire
        point of the opening shot, so it stacks directly under the basket and the
        leftover space goes to the bottom of the screen where nothing needs to be
        seen.
      */}
      <div
        style={{
          margin: "14px 18px 0",
          background: "#fff",
          borderRadius: 20,
          padding: "6px 18px",
        }}
      >
        {CART.lines.map((line, i) => (
          <div
            key={line.name}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "13px 0",
              borderBottom: i === CART.lines.length - 1 ? "none" : "1px solid #efeff2",
            }}
          >
            {line.qty ? (
              <span
                style={{
                  minWidth: 26,
                  height: 26,
                  borderRadius: 8,
                  background: "#efeff2",
                  color: "#55555f",
                  fontSize: 14,
                  fontWeight: 800,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {line.qty}
              </span>
            ) : (
              <span style={{ minWidth: 26 }} />
            )}
            <span
              style={{
                fontSize: 16,
                fontWeight: line.qty ? 600 : 500,
                color: line.qty ? "#12121a" : "#6f6f79",
              }}
            >
              {line.name}
            </span>
            <span
              style={{
                marginLeft: "auto",
                fontSize: 16,
                fontWeight: 700,
                fontVariantNumeric: "tabular-nums",
                color: line.qty ? "#12121a" : "#6f6f79",
              }}
            >
              {line.price}
            </span>
          </div>
        ))}
      </div>

      {/* The total. It brightens as the shot pushes in, so the eye is taken to
          the number rather than left to find it. */}
      <div style={{ padding: "16px 24px 0" }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            padding: "14px 18px",
            borderRadius: 18,
            background: `rgba(255,240,200,${0.12 + highlightTotal * 0.88})`,
            outline: `2px solid rgba(247,197,32,${highlightTotal * 0.9})`,
          }}
        >
          <span style={{ fontSize: 17, fontWeight: 700, color: "#3c3c45" }}>Total</span>
          <span
            style={{
              fontSize: 34,
              fontWeight: 800,
              letterSpacing: -1,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {PRICE.currency} {CART.total}
          </span>
        </div>
      </div>

      <div style={{ padding: "16px 24px 0" }}>
        <div
          style={{
            height: 56,
            borderRadius: 999,
            background: "#12121a",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 17,
            fontWeight: 800,
          }}
        >
          Place order
        </div>
      </div>

      <div style={{ flex: 1 }} />
    </Frame>
  );
}

/**
 * SnipSavor receiving the screenshot.
 *
 * This is the first frame of the ad that is ours, and the first that is warm
 * rather than grey. The jump from the neutral cart to the cream ground is doing
 * brand work that no logo animation would.
 */
export function UploadScreen({ progress = 0 }: { progress?: number }) {
  const lift = interpolate(progress, [0, 1], [220, 0], { extrapolateRight: "clamp" });
  const shrink = interpolate(progress, [0, 1], [1.15, 1], { extrapolateRight: "clamp" });

  return (
    <Frame background="#fdfaf4">
      <StatusBar />

      <div style={{ padding: "18px 26px 0", textAlign: "center" }}>
        <Img
          src={staticFile("icons/icon-192.png")}
          style={{ width: 52, height: 52, borderRadius: 14, margin: "0 auto" }}
        />
        <p style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.6, marginTop: 14 }}>
          {COPY.upload}
        </p>
        <p style={{ fontSize: 15, fontWeight: 600, color: "#7c8698", marginTop: 6 }}>
          One screenshot is all we need.
        </p>
      </div>

      <div
        style={{
          margin: "22px 30px",
          flex: 1,
          borderRadius: 26,
          border: "2px dashed rgba(247,197,32,0.85)",
          background: "rgba(255,248,225,0.55)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {/* The screenshot itself, dropping into the frame. */}
        <div
          style={{
            transform: `translateY(${lift}px) scale(${shrink})`,
            width: 176,
            borderRadius: 14,
            overflow: "hidden",
            boxShadow: "0 18px 40px rgba(18,18,26,0.22)",
            opacity: interpolate(progress, [0, 0.15], [0, 1], { extrapolateRight: "clamp" }),
          }}
        >
          <div style={{ transform: "scale(0.45)", transformOrigin: "top left", width: SCREEN_W, height: SCREEN_H * 0.45 }}>
            <CartScreen highlightTotal={1} />
          </div>
        </div>
      </div>
    </Frame>
  );
}

/**
 * The check running.
 *
 * Not a spinner. The brief is right that a loading screen is dead air, and the
 * honest alternative is to show the work: the restaurant matched, then each line
 * of the basket found on the other app. It is also what the product actually
 * does, line by line.
 */
export function ScanScreen({ matched = 0 }: { matched?: number }) {
  const frame = useCurrentFrame();
  const sweep = (frame * 9) % 460;

  return (
    <Frame background="#fdfaf4">
      <StatusBar />

      <div style={{ padding: "16px 26px 0", display: "flex", alignItems: "center", gap: 10 }}>
        <span
          style={{
            width: 34,
            height: 34,
            borderRadius: 999,
            background: "#ffd84d",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Search size={18} strokeWidth={3} color="#12121a" />
        </span>
        <div>
          <p style={{ fontSize: 19, fontWeight: 800, letterSpacing: -0.4 }}>{COPY.scanning}</p>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#7c8698" }}>
            {CART.restaurant} &middot; same basket
          </p>
        </div>
      </div>

      <div
        style={{
          position: "relative",
          margin: "18px 20px 0",
          background: "#fff",
          borderRadius: 22,
          padding: "4px 18px",
          overflow: "hidden",
        }}
      >
        {/* A scan line travelling down the basket. Understated, and the only
            thing in the ad that loops. */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: sweep,
            height: 120,
            background:
              "linear-gradient(180deg, transparent, rgba(255,216,77,0.30), transparent)",
          }}
        />

        {CART.lines.map((line, i) => {
          const isMatched = i < matched;
          return (
            <div
              key={line.name}
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                gap: 11,
                padding: "14px 0",
                borderBottom: i === CART.lines.length - 1 ? "none" : "1px solid #f1f1f4",
                opacity: isMatched ? 1 : 0.42,
                transition: "none",
              }}
            >
              <span
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 999,
                  background: isMatched ? "#e6f5ec" : "#f1f1f4",
                  color: "#1e8a4c",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transform: `scale(${isMatched ? 1 : 0.7})`,
                }}
              >
                {isMatched ? <Check size={15} strokeWidth={4} /> : null}
              </span>
              <span style={{ fontSize: 15, fontWeight: 600 }}>{line.name}</span>
              <span
                style={{
                  marginLeft: "auto",
                  fontSize: 15,
                  fontWeight: 800,
                  fontVariantNumeric: "tabular-nums",
                  color: isMatched ? "#1e8a4c" : "#9a9aa3",
                }}
              >
                {isMatched ? COMPARISON.lines[i].price : "···"}
              </span>
            </div>
          );
        })}
      </div>

      {/*
        The card used to carry flex:1 and stretch to the bottom of the screen,
        which left a third of the glass as blank white in every shot it appeared
        in. The space belongs to something that moves: how far through the basket
        the check has got.
      */}
      <div style={{ padding: "20px 24px 0" }}>
        <div
          style={{
            height: 8,
            borderRadius: 999,
            background: "#efe9d8",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${(matched / CART.lines.length) * 100}%`,
              height: "100%",
              borderRadius: 999,
              background: "#ffd84d",
            }}
          />
        </div>
        <p
          style={{
            marginTop: 12,
            fontSize: 14,
            fontWeight: 700,
            color: "#7c8698",
            textAlign: "center",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {matched} of {CART.lines.length} items matched
        </p>
      </div>

      <div style={{ flex: 1 }} />

      <div style={{ padding: "0 24px 34px", textAlign: "center" }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "#9a9aa3" }}>
          Prices checked at the time you asked
        </p>
      </div>
    </Frame>
  );
}

/**
 * The result, as the customer would actually receive it.
 *
 * Hedged, because the product is hedged: "could save", and a line saying this is
 * the same basket rebuilt on Keeta rather than a promise about every order.
 */
export function ResultScreen({ reveal = 1 }: { reveal?: number }) {
  return (
    <Frame background="#fdfaf4">
      <StatusBar />

      <div style={{ padding: "26px 28px 0", textAlign: "center" }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: "#7c8698" }}>
          {COPY.scanFound}
        </p>

        <div
          style={{
            marginTop: 20,
            borderRadius: 24,
            background: "#fff",
            border: "1px solid #e5e5e8",
            padding: "20px 22px",
            textAlign: "left",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: "#6f6f79" }}>Your cart</span>
            <span
              style={{
                fontSize: 26,
                fontWeight: 800,
                color: "#9a9aa3",
                textDecoration: "line-through",
                textDecorationThickness: 3,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {PRICE.currency} {CART.total}
            </span>
          </div>

          <div
            style={{
              marginTop: 14,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
            }}
          >
            <span style={{ fontSize: 15, fontWeight: 700, color: "#12121a" }}>
              {COMPARISON.app}
            </span>
            <span
              style={{
                fontSize: 40,
                fontWeight: 800,
                color: "#1e8a4c",
                letterSpacing: -1.2,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {PRICE.currency} {COMPARISON.total}
            </span>
          </div>
        </div>

        <div
          style={{
            marginTop: 18,
            borderRadius: 20,
            background: "#e6f5ec",
            padding: "16px 20px",
            opacity: reveal,
            transform: `scale(${0.94 + reveal * 0.06})`,
          }}
        >
          <p style={{ fontSize: 14, fontWeight: 700, color: "#1e8a4c" }}>You could save</p>
          <p
            style={{
              fontSize: 44,
              fontWeight: 800,
              color: "#1e8a4c",
              letterSpacing: -1.4,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {PRICE.currency} {PRICE.saving}
          </p>
        </div>

        {/*
          Where the saving came from, line by line.
          A total that is lower with no visible cause reads as a trick; two
          cheaper items and a waived delivery fee is how it actually happens, and
          it fills the half of the screen that was otherwise blank.
        */}
        <div style={{ marginTop: 22, textAlign: "left" }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#9a9aa3", letterSpacing: 0.4 }}>
            WHAT CHANGED
          </p>
          {CART.lines.map((line, i) => {
            const was = Number(line.price);
            const now = Number(COMPARISON.lines[i].price);
            if (was === now) return null;
            return (
              <div
                key={line.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "9px 0",
                  borderBottom: "1px solid #eee9dd",
                }}
              >
                <span style={{ fontSize: 14, fontWeight: 600, color: "#3c3c45" }}>
                  {line.name}
                </span>
                <span
                  style={{
                    marginLeft: "auto",
                    fontSize: 14,
                    fontWeight: 700,
                    color: "#9a9aa3",
                    textDecoration: "line-through",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {line.price}
                </span>
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 800,
                    color: "#1e8a4c",
                    fontVariantNumeric: "tabular-nums",
                    minWidth: 44,
                    textAlign: "right",
                  }}
                >
                  {now === 0 ? "Free" : COMPARISON.lines[i].price}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </Frame>
  );
}
