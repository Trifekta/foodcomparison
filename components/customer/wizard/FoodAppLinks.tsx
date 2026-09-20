"use client";

import { Smartphone } from "lucide-react";
import { track } from "@/lib/analytics/track";
import { markLeavingForApp } from "@/lib/customer/wizard-session";

/**
 * The four apps a cart can come from, and how to get to one.
 *
 * Plain https links, opened in a new tab. That is not a fallback for deep
 * linking - on a phone it IS the deep link: Android App Links and iOS Universal
 * Links hand a verified https URL straight to the installed app, and the web
 * page is what happens when the app is not installed. A talabat:// scheme would
 * only add a way to fail on desktop and in every browser that blocks unknown
 * schemes.
 *
 * The marks are typeset, not drawn. There are no brand logo files in this
 * repository, and inventing approximations of somebody else's trademark is
 * worse than a tile that plainly is not one; the colours are theirs, the letter
 * is ours, and the whole thing is swapped for real artwork by dropping files in
 * and changing `mark` below.
 */
const FOOD_APPS = [
  { name: "Talabat", href: "https://www.talabat.com/uae", mark: "t", tile: "bg-[#FF5A00]", ink: "text-white" },
  { name: "Careem", href: "https://www.careem.com/en-AE/food/", mark: "C", tile: "bg-[#3EB55B]", ink: "text-white" },
  { name: "Deliveroo", href: "https://deliveroo.onelink.me/9Aoc/NewHomepageCardAEEN", mark: "D", tile: "bg-[#00CCBC]", ink: "text-white" },
  { name: "Noon Food", href: "https://food.noon.com/uae-en/", mark: "n", tile: "bg-[#FEEE00]", ink: "text-ink-900" },
] as const;

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
    <section className="rounded-2xl border border-brand-200 bg-beige p-4">
      <h2 className="flex items-center gap-1.5 text-[0.95rem] font-bold text-ink-900">
        <Smartphone aria-hidden="true" className="h-4 w-4 shrink-0 text-ink-500" />
        No screenshot yet?
      </h2>

      <ol className="mt-2.5 space-y-1.5">
        {STEPS.map((step, index) => (
          <li key={step} className="flex gap-2">
            <span
              aria-hidden="true"
              className="text-[0.85rem] font-bold tabular-nums text-ink-500"
            >
              {index + 1}.
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
            className="flex min-h-12 items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-2 py-2 text-left text-[0.8rem] font-semibold text-ink-900 hover:bg-ink-50"
          >
            <span
              aria-hidden="true"
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[0.95rem] font-black ${app.tile} ${app.ink}`}
            >
              {app.mark}
            </span>
            {/* One line each. Wrapping put the four labels on four different
                break points and the grid read as unfinished; the chevron the
                design had here is what paid for the width - "Open Noon Food"
                was being clipped with it in place, and a tile this size beside
                a verb is already plainly a link. */}
            <span className="min-w-0 flex-1 whitespace-nowrap leading-tight">Open {app.name}</span>
          </a>
        ))}
      </div>
    </section>
  );
}
