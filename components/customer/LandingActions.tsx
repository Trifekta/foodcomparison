"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { ArrowRight, Camera, Eye, X } from "lucide-react";
import { track } from "@/lib/analytics/track";
import {
  EXAMPLE_COMPARISON,
  EXAMPLE_NEEDS_REAL_DATA,
  aed,
} from "@/lib/customer/example-comparison";

/**
 * The two things this screen asks for, and the sheet behind the second one.
 *
 * Both buttons are here rather than in the page because both have to be
 * recorded, and recording needs a browser. The page itself stays a server
 * component: it is the first paint of an advert click, and the less that runs
 * before it appears the better.
 *
 * The primary link is a real <Link>, not a button that navigates. Prefetch,
 * middle-click, long-press-to-copy and the browser's own "open in new tab" all
 * come free from an anchor with an href, and a customer who opens the wizard in
 * a second tab is still a customer. The tracking hangs off the click rather
 * than replacing it - track() uses sendBeacon precisely so that the last thing
 * a tab does before navigating still arrives.
 */

/**
 * The secondary offer, and the one thing on this screen that could cost
 * conversions.
 *
 * It sits beside the primary button and openly offers somewhere else to go,
 * which is a real risk: the visit that would have tapped "Check my cart" and
 * taps this instead has been slowed down, not helped. It earns its place only
 * if it converts the visit that was going to leave anyway - the one that does
 * not yet believe there is money in this.
 *
 * So it is a sheet and not a page. A page would be a navigation away from the
 * button that matters, and a second chance to lose them on the way back; a
 * sheet keeps the primary call to action one dismissal away, and repeats it at
 * the bottom so that being convinced and acting on it are the same gesture.
 */
function ExampleSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const { fromApp, basket, lines, delivery, fromTotal, toTotal, saved } = EXAMPLE_COMPARISON;

  // The column heading for the "before" price. See EXAMPLE_COMPARISON.fromApp:
  // a real brand's name does not go above invented numbers.
  const fromLabel = fromApp ?? "Delivery app";

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      aria-labelledby={titleId}
      className="w-[min(26rem,calc(100vw-2rem))] rounded-3xl bg-canvas p-0 backdrop:bg-black/60"
    >
      <div className="max-h-[85dvh] overflow-y-auto p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-[1.05rem] font-extrabold leading-snug text-ink-900">
            {EXAMPLE_NEEDS_REAL_DATA
              ? "What you get back"
              : "A real order we checked"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-ink-100"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-1 text-[0.85rem] text-slate-500">{basket}</p>

        <div className="mt-4 overflow-hidden rounded-2xl bg-white ring-1 ring-ink-100">
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 px-3.5 pt-3 text-[0.7rem] font-bold uppercase tracking-[0.06em] text-ink-500">
            <span>Item</span>
            <span className="text-right">{fromLabel}</span>
            <span className="text-right">Keeta</span>
          </div>

          {lines.map((line) => (
            <div
              key={line.name}
              className="grid grid-cols-[1fr_auto_auto] items-baseline gap-x-3 border-t border-ink-100 px-3.5 py-2.5 first:border-t-0"
            >
              <span className="min-w-0 text-[0.85rem] text-ink-800">{line.name}</span>
              <span className="text-right text-[0.85rem] tabular-nums text-slate-500 line-through decoration-slate-400">
                {aed(line.from)}
              </span>
              <span className="text-right text-[0.85rem] font-bold tabular-nums text-ink-900">
                {aed(line.to)}
              </span>
            </div>
          ))}

          <div className="grid grid-cols-[1fr_auto_auto] items-baseline gap-x-3 border-t border-ink-100 px-3.5 py-2.5">
            <span className="min-w-0 text-[0.85rem] text-slate-500">Delivery</span>
            <span className="text-right text-[0.85rem] tabular-nums text-slate-500 line-through decoration-slate-400">
              {aed(delivery.from)}
            </span>
            <span className="text-right text-[0.85rem] font-bold tabular-nums text-ink-900">
              {aed(delivery.to)}
            </span>
          </div>

          <div className="grid grid-cols-[1fr_auto_auto] items-baseline gap-x-3 border-t-2 border-ink-100 bg-beige px-3.5 py-3">
            <span className="min-w-0 text-[0.9rem] font-extrabold text-ink-900">Total</span>
            <span className="text-right text-[0.9rem] tabular-nums text-slate-500 line-through decoration-slate-400">
              {aed(fromTotal)}
            </span>
            <span className="text-right text-[1rem] font-extrabold tabular-nums text-ink-900">
              {aed(toTotal)}
            </span>
          </div>
        </div>

        <p className="mt-3 inline-block rounded-full bg-chip-green-bg px-3.5 py-1.5 text-[0.95rem] font-extrabold text-chip-green-fg">
          You keep AED {aed(saved)}
        </p>

        {/* Where the example says what kind of thing it is. The wording is
            driven by the data rather than typed here, so the day real numbers
            arrive this line stops calling itself an illustration by itself. */}
        <p className="mt-3 text-[0.78rem] leading-relaxed text-slate-500">
          {EXAMPLE_NEEDS_REAL_DATA
            ? "An illustration of how a comparison looks. Your own result uses the real prices on your cart the moment you send it."
            : "A real order we checked. Your own result uses the real prices on your cart the moment you send it."}
        </p>

        {/* The offer again, at the bottom of the thing that was meant to make
            them want it. Being convinced and acting on it should not be two
            separate decisions with a dismissal in between. */}
        <Link
          href="/compare"
          onClick={() => track("cta_check_cart")}
          className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-400 text-[0.95rem] font-extrabold text-ink-900 hover:bg-brand-500"
        >
          <Camera aria-hidden="true" className="h-[1.15rem] w-[1.15rem]" />
          Check my cart
        </Link>
      </div>
    </dialog>
  );
}

export function LandingActions() {
  const [showExample, setShowExample] = useState(false);

  return (
    <>
      <Link
        href="/compare"
        onClick={() => track("cta_check_cart")}
        className="relative mt-4 inline-flex min-h-14 w-full items-center justify-center gap-2.5 rounded-full bg-brand-400 px-6 text-base font-bold text-ink-900 shadow-sm transition-colors hover:bg-brand-300 active:bg-brand-500"
      >
        <Camera aria-hidden="true" className="h-5 w-5" />
        Check my cart
        <ArrowRight aria-hidden="true" className="absolute right-6 h-5 w-5" />
      </Link>

      <button
        type="button"
        onClick={() => {
          track("cta_example");
          setShowExample(true);
        }}
        className="relative mt-2.5 inline-flex min-h-13 w-full items-center justify-center gap-2.5 rounded-full border border-ink-200 bg-white px-6 text-[0.98rem] font-bold text-ink-900 transition-colors hover:bg-ink-50"
      >
        <Eye aria-hidden="true" className="h-5 w-5 text-ink-500" />
        See an example
        <ArrowRight aria-hidden="true" className="absolute right-6 h-5 w-5 text-ink-400" />
      </button>

      <ExampleSheet open={showExample} onClose={() => setShowExample(false)} />
    </>
  );
}
