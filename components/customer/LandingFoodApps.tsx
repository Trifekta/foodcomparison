"use client";

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { track } from "@/lib/analytics/track";
import { FOOD_APPS, type FoodApp } from "@/lib/customer/food-apps";
import {
  consumeReturnToLanding,
  markLeavingLandingForApp,
} from "@/lib/customer/landing-session";

/**
 * The way out, for the people who cannot start yet.
 *
 * This card is an answer to one specific dead end. Somebody arrives from an
 * advert, reads "upload your cart screenshot", and does not have one - has
 * never taken one, is not currently ordering anything. Left unaddressed that is
 * the end of the visit, and it is a large share of the people this page loses.
 *
 * It sits BELOW both calls to action, and that position is the whole point of
 * the change. Above them it competed with the primary button and read as an
 * instruction to everybody - including the people who already had a screenshot
 * in their camera roll and were about to use it. Below them it is what it
 * actually is: an aside for the subset it applies to.
 *
 * Tinted rather than white, with no numbered badge, for the same reason the
 * wizard's version is: the cards above it are steps in a sequence, and this is
 * not one of them.
 */

/** One app's square tile: its real icon, or the letter that stands in. */
function AppTile({ app }: { app: FoodApp }) {
  const [missing, setMissing] = useState(false);

  return (
    <span
      aria-hidden="true"
      className={`flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl text-[1.4rem] font-black ${app.tile} ${app.ink}`}
    >
      {missing ? (
        app.mark
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={app.logo}
          alt=""
          width={56}
          height={56}
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

export function LandingFoodApps() {
  /**
   * The return, counted once.
   *
   * There is no page load to hang this on. The tiles open in a new context, so
   * coming back is the tab becoming visible again - not a navigation - and
   * nothing but visibilitychange can see it.
   *
   * The flag it reads is armed by a deliberate tap and by nothing else, which
   * is what keeps this from counting lock screens and notification shades as
   * shopping trips. Consuming it disarms it, so a customer who comes back and
   * then glances at a message is one return, not three.
   *
   * On a desktop browser the tile opens a sibling tab and this page never
   * hides, so no return is recorded. That is a known gap and an acceptable one:
   * the traffic this exists to measure is on a phone, where leaving for an app
   * genuinely backgrounds the browser.
   */
  useEffect(() => {
    const onVisible = () => {
      if (document.hidden || !consumeReturnToLanding()) return;
      track("returned_from_app");
    };

    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  return (
    <section className="mt-5 rounded-3xl border border-brand-200 bg-beige p-4">
      <h2 className="text-[1rem] font-extrabold text-ink-900">
        Don&apos;t have a cart screenshot yet?
      </h2>
      <p className="mt-1.5 text-[0.88rem] leading-relaxed text-slate-600">
        Open your food app, build your cart, take a screenshot, then come back to SnipSavor.
      </p>

      <div className="mt-3.5 grid grid-cols-4 gap-2">
        {FOOD_APPS.map((app) => (
          <a
            key={app.name}
            href={app.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              // Both before the navigation, and both fire-and-forget: track()
              // uses sendBeacon precisely so the last thing a tab does before
              // going away still arrives.
              markLeavingLandingForApp();
              track("landing_app_opened");
            }}
            className="flex flex-col items-center gap-1.5 rounded-2xl p-1 text-center hover:bg-white/70"
          >
            <AppTile app={app} />
            <span className="text-[0.75rem] font-semibold leading-tight text-ink-800">
              {app.name}
            </span>
          </a>
        ))}
      </div>

      {/* Says out loud that these leave the site.
          A row of app icons under a heading about screenshots is ambiguous in
          the worst way - it could as easily mean "these are the apps we
          support" - and a customer who taps one expecting a filter and lands in
          Talabat has been ejected from the funnel by a misunderstanding. */}
      <p className="mt-3 flex items-start gap-1.5 text-[0.78rem] leading-relaxed text-slate-500">
        <ExternalLink aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        These links will open the apps. Come back here with your screenshot.
      </p>
    </section>
  );
}
