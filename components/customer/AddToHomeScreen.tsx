"use client";

import { useEffect, useState } from "react";
import { Share, Plus, X } from "lucide-react";
import { dismissHomeScreenHint, shouldOfferHomeScreen } from "@/lib/pwa/install";
import { pushSupported } from "@/lib/push/client";
import { BRAND_NAME } from "@/lib/constants";

/**
 * The one moment this is worth saying.
 *
 * The screen above has just promised to tell the customer when their result is
 * ready. On an iPhone in Safari that promise cannot be kept: Apple delivers Web
 * Push only to a copy added to the Home Screen, so the notification button
 * renders nothing there and the customer is left watching a page.
 *
 * So this is not an install prompt. It is the missing half of a promise already
 * made, shown at the only point in the flow where it changes what happens next -
 * while they are waiting, to this order, for this result.
 *
 * Everything about it is deliberately small: inline rather than a modal or a
 * banner over the content, dismissed for good with one tap, and never shown to
 * anybody it would not help - not Android, where push already works in the
 * browser, and not inside Instagram's or Facebook's browser, where the menu it
 * describes does not exist.
 */
export function AddToHomeScreen() {
  // False until mounted, so the server and the first client paint agree. Every
  // condition behind this is a browser-only value.
  const [show, setShow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShow(shouldOfferHomeScreen(pushSupported())), 0);
    return () => clearTimeout(timer);
  }, []);

  if (!show) return null;

  return (
    <section
      aria-label={`Get notified by adding ${BRAND_NAME} to your Home Screen`}
      className="relative mt-5 rounded-3xl bg-cream px-4 py-4 ring-1 ring-sand"
    >
      <button
        type="button"
        onClick={() => {
          dismissHomeScreenHint();
          setShow(false);
        }}
        aria-label="No thanks"
        className="absolute right-1.5 top-1.5 inline-flex h-11 w-11 items-center justify-center rounded-full text-slate-400 hover:bg-ink-100 hover:text-ink-700"
      >
        <X aria-hidden="true" className="h-4 w-4" />
      </button>

      <p className="pr-10 text-[1rem] font-extrabold leading-snug text-ink-900">
        Want a buzz when it&apos;s ready?
      </p>
      <p className="mt-1 pr-6 text-[0.9rem] leading-relaxed text-ink-600">
        iPhone only sends notifications from an app on your Home Screen. Add {BRAND_NAME} once and
        we&apos;ll tell you the moment your result lands — no app store, nothing to download.
      </p>

      {/* The two taps, shown rather than described. Somebody glancing at this
          while waiting should not have to read a sentence to follow it. */}
      <ol className="mt-3 flex items-center gap-2 text-[0.85rem] font-semibold text-ink-800">
        <li className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1.5 ring-1 ring-ink-200">
          <Share aria-hidden="true" className="h-3.5 w-3.5" />
          Share
        </li>
        <li aria-hidden="true" className="text-slate-400">
          →
        </li>
        <li className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1.5 ring-1 ring-ink-200">
          <Plus aria-hidden="true" className="h-3.5 w-3.5" />
          Add to Home Screen
        </li>
      </ol>

      <p className="mt-2.5 text-[0.8rem] text-slate-500">
        Your result stays on this page either way — keep it open and it updates itself.
      </p>
    </section>
  );
}
