"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Info, X } from "lucide-react";

/**
 * What a good screenshot looks like.
 *
 * The helper line under each upload can say "make sure the restaurant name is
 * visible", and people still send the middle of a menu. A picture of the thing
 * settles in a second what a sentence argues about - and it has to be opt-in,
 * behind an icon, because the screen where somebody weighs the wait against the
 * effort of finding a screenshot is not the screen to lecture them on.
 *
 * Drawn rather than photographed, for two reasons. A real screenshot of a real
 * delivery app would put another company's interface and branding inside ours,
 * which is not ours to show; and a wireframe is clearer anyway, because
 * everything that is not the point has been left out of it.
 */

export type ScreenshotExample = "cart" | "checkout";

const INK = "#12121a";
const MUTED = "#9a9aa3";
const LINE = "#e5e5e8";
const GOLD = "#ffd84d";
const GOLD_DEEP = "#b58600";

/** A numbered gold dot, keyed to the list under the drawing. */
function Marker({ x, y, n }: { x: number; y: number; n: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r="11" fill={GOLD} />
      <text
        x={x}
        y={y + 4}
        textAnchor="middle"
        fontSize="12"
        fontWeight="800"
        fill={INK}
      >
        {n}
      </text>
    </g>
  );
}

function CartDrawing() {
  return (
    <svg viewBox="0 0 300 330" className="h-auto w-full" role="img" aria-hidden="true">
      <rect x="8" y="8" width="284" height="314" rx="22" fill="#fff" stroke={LINE} strokeWidth="2" />

      {/* Header: the restaurant name, which is the one thing we cannot guess. */}
      <rect x="22" y="26" width="256" height="44" rx="12" fill="none" stroke={GOLD} strokeWidth="3" />
      <circle cx="44" cy="48" r="10" fill="none" stroke={MUTED} strokeWidth="2" />
      <text x="66" y="44" fontSize="11" fill={MUTED}>Cart</text>
      <text x="66" y="60" fontSize="14" fontWeight="800" fill={INK}>Restaurant name</text>
      <Marker x={268} y={26} n={1} />

      <line x1="22" y1="84" x2="278" y2="84" stroke={LINE} strokeWidth="2" />

      {/* Two item rows: name, options, price. */}
      <text x="26" y="110" fontSize="14" fontWeight="700" fill={INK}>Item name</text>
      <text x="26" y="128" fontSize="11" fill={MUTED}>Options, sides, drink</text>
      <rect x="22" y="138" width="92" height="26" rx="8" fill="none" stroke={GOLD} strokeWidth="3" />
      <text x="32" y="156" fontSize="13" fontWeight="800" fill={INK}>AED 32.20</text>
      <rect x="206" y="96" width="72" height="68" rx="12" fill="#f7f7f8" />
      <Marker x={128} y={151} n={2} />

      <line x1="22" y1="180" x2="278" y2="180" stroke={LINE} strokeWidth="2" />

      <text x="26" y="206" fontSize="14" fontWeight="700" fill={INK}>Item name</text>
      <rect x="22" y="218" width="86" height="26" rx="8" fill="none" stroke={GOLD} strokeWidth="3" />
      <text x="32" y="236" fontSize="13" fontWeight="800" fill={INK}>AED 5.60</text>
      <rect x="206" y="192" width="72" height="68" rx="12" fill="#f7f7f8" />

      <line x1="22" y1="276" x2="278" y2="276" stroke={LINE} strokeWidth="2" />
      <text x="26" y="300" fontSize="11" fill={MUTED}>You might also like…</text>
    </svg>
  );
}

function CheckoutDrawing() {
  const row = (y: number, label: string, value: string, bold = false) => (
    <g key={label}>
      <text x="30" y={y} fontSize="13" fontWeight={bold ? "800" : "400"} fill={bold ? INK : MUTED}>
        {label}
      </text>
      <text
        x="270"
        y={y}
        textAnchor="end"
        fontSize="13"
        fontWeight={bold ? "800" : "600"}
        fill={INK}
      >
        {value}
      </text>
    </g>
  );

  return (
    <svg viewBox="0 0 300 330" className="h-auto w-full" role="img" aria-hidden="true">
      <rect x="8" y="8" width="284" height="314" rx="22" fill="#fff" stroke={LINE} strokeWidth="2" />

      <text x="30" y="52" fontSize="15" fontWeight="800" fill={INK}>Payment summary</text>
      <line x1="22" y1="68" x2="278" y2="68" stroke={LINE} strokeWidth="2" />

      {row(98, "Subtotal", "AED 54.00")}
      {row(130, "Delivery", "AED 0.00")}
      {row(162, "Discount", "-AED 16.20")}
      {row(194, "Service fee", "AED 2.70")}

      <rect x="22" y="212" width="256" height="42" rx="12" fill="none" stroke={GOLD} strokeWidth="3" />
      {row(240, "Total amount", "AED 40.50", true)}
      <Marker x={268} y={212} n={1} />

      <rect x="22" y="274" width="118" height="32" rx="16" fill="#f7f7f8" />
      <rect x="160" y="274" width="118" height="32" rx="16" fill={GOLD} opacity="0.35" />
    </svg>
  );
}

const CONTENT: Record<
  ScreenshotExample,
  { title: string; drawing: () => React.ReactElement; points: string[]; note: string }
> = {
  cart: {
    title: "What your cart screenshot should show",
    drawing: CartDrawing,
    points: [
      "The restaurant name at the top — we cannot look it up without it.",
      "Every item with its price, scrolled so none are cut off.",
    ],
    note: "The suggestions underneath (“You might also like…”) are ignored — they are not part of your order.",
  },
  checkout: {
    title: "What your checkout screenshot should show",
    drawing: CheckoutDrawing,
    points: ["The final total, with the fees and any discount above it."],
    note: "This is the number we compare against, so sending it is what makes the comparison exact rather than close.",
  },
};

/**
 * The (i) beside an upload, and the sheet it opens.
 *
 * State lives here rather than in the upload slot: the slot has enough to do,
 * and nothing outside this file needs to know the sheet exists.
 *
 * Built on <dialog>, like the screenshot lightbox, so Escape, focus trapping
 * and inertness of the page behind come from the element rather than from code
 * that has to be kept right.
 */
export function ScreenshotExampleButton({
  example,
  forLabel,
}: {
  example: ScreenshotExample;
  /** Names the upload this explains, so the button is not just "more info". */
  forLabel: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const { title, drawing: Drawing, points, note } = CONTENT[example];

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`See an example of the ${forLabel.toLowerCase()} screenshot`}
        className="-mr-1 mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-brand-100 hover:text-ink-900"
      >
        <Info aria-hidden="true" className="h-[1.15rem] w-[1.15rem]" />
      </button>

      <dialog
        ref={ref}
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target === ref.current) setOpen(false);
        }}
        aria-labelledby={titleId}
        className="w-[min(26rem,calc(100vw-2rem))] rounded-3xl bg-canvas p-0 backdrop:bg-black/60"
      >
        <div className="max-h-[85dvh] overflow-y-auto p-5">
          <div className="flex items-start justify-between gap-3">
            <h2 id={titleId} className="text-[1.05rem] font-extrabold leading-snug text-ink-900">
              {title}
            </h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="-mr-1 -mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-ink-100"
            >
              <X aria-hidden="true" className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-3 rounded-2xl bg-white p-2 ring-1 ring-ink-100">
            <Drawing />
          </div>

          <ol className="mt-4 space-y-2.5">
            {points.map((point, index) => (
              <li key={point} className="flex items-start gap-2.5">
                <span
                  aria-hidden="true"
                  className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-400 text-[0.7rem] font-extrabold text-ink-900"
                >
                  {index + 1}
                </span>
                <span className="text-sm leading-relaxed text-ink-800">{point}</span>
              </li>
            ))}
          </ol>

          <p className="mt-3 text-xs leading-relaxed" style={{ color: GOLD_DEEP }}>
            {note}
          </p>

          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-4 min-h-11 w-full rounded-2xl bg-brand-400 text-[0.95rem] font-extrabold text-ink-900 hover:bg-brand-500"
          >
            Got it
          </button>
        </div>
      </dialog>
    </>
  );
}
