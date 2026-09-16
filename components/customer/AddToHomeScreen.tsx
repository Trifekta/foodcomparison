"use client";

import { useEffect, useState } from "react";
import { Share, Plus, MoreHorizontal, Compass, X } from "lucide-react";
import { dismissHomeScreenHint, homeScreenRoute, type HomeScreenRoute } from "@/lib/pwa/install";
import { pushSupported } from "@/lib/push/client";
import { BRAND_NAME } from "@/lib/constants";

/**
 * The one moment this is worth saying.
 *
 * The screen above has just promised to tell the customer when their result is
 * ready, and the browser they are in cannot do it. During validation that
 * result is produced by a person and takes a few minutes, so they have genuinely
 * closed the tab and gone - which makes this the difference between a result
 * they see and a result they miss.
 *
 * So it is not an install prompt. It is the missing half of a promise already
 * made, shown at the only point in the flow where it changes what happens to
 * this order.
 *
 * Inline rather than a modal or a floating banner, dismissed for good with one
 * tap, and never shown to anybody it would not help. What it says depends
 * entirely on where they are: see lib/pwa/install.ts.
 */

interface Copy {
  heading: string;
  body: string;
  steps: Array<{ icon: typeof Share; label: string }>;
}

function copyFor(route: Exclude<HomeScreenRoute, null>): Copy {
  switch (route) {
    case "ios-direct":
      return {
        heading: "Want a buzz when it's ready?",
        body: `iPhone only sends notifications from an app on your Home Screen. Add ${BRAND_NAME} once and we'll tell you the moment your result lands — no app store, nothing to download.`,
        steps: [
          { icon: Share, label: "Share" },
          { icon: Plus, label: "Add to Home Screen" },
        ],
      };

    // Honest about the extra tap rather than hiding it. Somebody who follows a
    // three-step instruction and finds a fourth stops following it.
    case "ios-in-app":
      return {
        heading: "Want a buzz when it's ready?",
        body: `Instagram's browser can't send notifications. Open this page in Safari and add ${BRAND_NAME} to your Home Screen — then we'll tell you the moment your result lands.`,
        steps: [
          { icon: MoreHorizontal, label: "Menu" },
          { icon: Compass, label: "Open in Safari" },
          { icon: Plus, label: "Add to Home Screen" },
        ],
      };

    // The easy one. Chrome does push in an ordinary tab, so there is nothing to
    // install - the whole fix is leaving the embedded browser.
    case "android-in-app":
      return {
        heading: "Want a buzz when it's ready?",
        body: "Instagram's browser can't send notifications. Open this page in Chrome and you can switch them on in one tap — nothing to install.",
        steps: [
          { icon: MoreHorizontal, label: "Menu" },
          { icon: Compass, label: "Open in Chrome" },
        ],
      };
  }
}

export function AddToHomeScreen() {
  // Null until mounted, so the server and the first client paint agree.
  const [route, setRoute] = useState<HomeScreenRoute>(null);

  useEffect(() => {
    const timer = setTimeout(() => setRoute(homeScreenRoute(pushSupported())), 0);
    return () => clearTimeout(timer);
  }, []);

  if (!route) return null;
  const { heading, body, steps } = copyFor(route);

  return (
    <section
      aria-label="How to be notified when your result is ready"
      className="relative mt-5 rounded-3xl bg-cream px-4 py-4 ring-1 ring-sand"
    >
      <button
        type="button"
        onClick={() => {
          dismissHomeScreenHint();
          setRoute(null);
        }}
        aria-label="No thanks"
        className="absolute right-1.5 top-1.5 inline-flex h-11 w-11 items-center justify-center rounded-full text-slate-400 hover:bg-ink-100 hover:text-ink-700"
      >
        <X aria-hidden="true" className="h-4 w-4" />
      </button>

      <p className="pr-10 text-[1rem] font-extrabold leading-snug text-ink-900">{heading}</p>
      <p className="mt-1 pr-6 text-[0.9rem] leading-relaxed text-ink-600">{body}</p>

      {/* The taps, shown rather than described. Somebody glancing at this while
          waiting should not have to read a sentence to follow it. Wrapped,
          because the longest route is three chips on a 360px screen. */}
      <ol className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2 text-[0.85rem] font-semibold text-ink-800">
        {steps.map((step, index) => (
          <li key={step.label} className="inline-flex items-center gap-2">
            {index > 0 ? (
              <span aria-hidden="true" className="text-slate-400">
                →
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1.5 ring-1 ring-ink-200">
              <step.icon aria-hidden="true" className="h-3.5 w-3.5" />
              {step.label}
            </span>
          </li>
        ))}
      </ol>

      <p className="mt-2.5 text-[0.8rem] text-slate-500">
        Your result stays on this page either way — keep it open and it updates itself.
      </p>
    </section>
  );
}
