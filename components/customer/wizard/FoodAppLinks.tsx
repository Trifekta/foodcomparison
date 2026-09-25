"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { track } from "@/lib/analytics/track";
import { FOOD_APPS, type FoodApp } from "@/lib/customer/food-apps";
import { markLeavingForApp } from "@/lib/customer/wizard-session";

/**
 * Four steps, kept as four.
 *
 * They were briefly one sentence of four clauses, which is shorter and worse:
 * the numbering is what says "this is a defined process with an end", and that
 * claim is the entire reason this card exists. Somebody weighing whether to
 * leave needs to see how far away coming back is.
 *
 * "of your cart" is load-bearing on step three - the slot below this card asks
 * for a second screenshot, so "take one screenshot" contradicted it.
 */
const STEPS = [
  "Open your food app",
  "Build your cart",
  "Take a screenshot of your cart",
  "Come back here — your progress is saved",
] as const;

/**
 * One app's square mark: its real icon, or the letter that stands in.
 *
 * The icons are committed, so the fallback is not a placeholder waiting to be
 * replaced - it is what the tile does when the request for a 2 KB file does
 * not come back. Blocked by a network, missed by a rename, dropped on a bad
 * connection: all three arrive here as onError, and all three deserve a tile
 * that still says which app it opens.
 *
 * The brand colour is painted underneath either way. That is what shows
 * through the icon's transparent corners, which is why it is sampled from the
 * icon itself rather than from a brand guideline.
 */
function AppMark({ app }: { app: FoodApp }) {
  const [missing, setMissing] = useState(false);

  return (
    <span
      aria-hidden="true"
      className={`flex h-6 w-6 min-[390px]:h-8 min-[390px]:w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg text-[0.95rem] font-black ${app.tile} ${app.ink}`}
    >
      {missing ? (
        app.mark
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={app.logo}
          alt=""
          width={32}
          height={32}
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setMissing(true)}
          className="h-full w-full object-cover"
        />
      )}
    </span>
  );
}

/**
 * Leaving, made part of the plan.
 *
 * Somebody arriving from an advert has no screenshot and no idea they need
 * one, so the first thing this screen asks of them is to go somewhere else.
 * Left unsaid, that reads as a dead end and they close the tab. Said out loud,
 * with the four apps one tap away and a promise that coming back is safe, it
 * reads as step one of four.
 *
 * Tinted rather than white, and with no numbered badge of its own, because it
 * sits BETWEEN the two upload slots: given the same white card and the same
 * circled glyph in the same corner, it read as a step one-and-a-half in a
 * sequence it is not part of. This is an aside, and has to look like one.
 */
export function FoodAppLinks() {
  return (
    <section className="rounded-2xl border border-brand-200 bg-beige p-3">
      <h2 className="flex items-center gap-1.5 text-base font-extrabold text-ink-900">
        Choose your food app
      </h2>

      <ol className="mt-2.5 space-y-1.5">
        {STEPS.map((step, index) => (
          <li key={step} className="flex gap-2">
            <span
              aria-hidden="true"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-400 text-sm font-bold text-ink-900"
            >
              {index + 1}
            </span>
            <span className="text-[0.85rem] leading-snug text-slate-600">{step}</span>
          </li>
        ))}
      </ol>

      <div className="mt-3.5 grid grid-cols-2 gap-2">
        {FOOD_APPS.map((app) => (
          <a
            key={app.name}
            href={app.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              // Both before the navigation, and both fire-and-forget: track
              // uses sendBeacon precisely so the last thing a tab does before
              // going away still arrives.
              markLeavingForApp();
              track("app_opened");
            }}
            className="last:odd:col-span-2 flex min-h-14 items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-2 py-2 text-left text-[0.8rem] font-semibold text-ink-900 hover:bg-ink-50"
          >
            <AppMark app={app} />
            <span className="min-w-0 flex-1 leading-tight">Open <span className="inline-block">{app.name}</span></span>
            <ChevronRight aria-hidden="true" className="hidden h-4 w-4 shrink-0 min-[390px]:block" />
          </a>
        ))}
      </div>
    </section>
  );
}
