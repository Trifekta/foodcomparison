"use client";

import { useEffect, useRef } from "react";
import { track } from "@/lib/analytics/track";
import { percentSeen, scrollEvent } from "@/lib/analytics/scroll";

/**
 * One reading per visit: how far down this screen they ever got.
 *
 * Sent once, on the way out, rather than as each quarter is crossed. Four
 * events per visit would be four times the budget on an endpoint capped at
 * sixty per ten minutes per IP - and that cap is shared, so a handful of
 * people on one venue's wifi, which is exactly the traffic an advert buys,
 * would start losing real funnel steps to make room for scroll marks. The
 * heartbeat needed its own larger budget for this reason; this needs not to.
 *
 * "On the way out" is three different moments, because on a phone only the
 * first two usually happen: the tab being hidden (switching away, locking the
 * screen, tapping through to a food app), the page being unloaded, and this
 * component being unmounted - which is what advancing past the upload step
 * looks like. sendBeacon, inside track(), is what makes a send at any of them
 * survive the navigation that follows.
 *
 * Whichever fires first wins and the rest are no-ops: what is worth knowing is
 * how far they had got when they decided, and a visit that comes back and
 * reads further has already answered the question being asked.
 */
export function ScrollDepth() {
  const deepest = useRef(0);
  const sent = useRef(false);
  const departure = useRef<number | null>(null);

  useEffect(() => {
    // A cleanup that is immediately followed by this effect running again is
    // not a departure - React does exactly that on every mount in development,
    // and may do it whenever it re-runs an effect. Sending straight from the
    // cleanup therefore fired on arrival with the opening reading and latched
    // `sent`, so the real departure never recorded anything: every visit was
    // filed at whatever was on screen before anybody had moved.
    if (departure.current !== null) {
      clearTimeout(departure.current);
      departure.current = null;
    }

    const measure = () => {
      const seen = percentSeen(
        window.scrollY,
        window.innerHeight,
        document.documentElement.scrollHeight,
      );
      if (seen > deepest.current) deepest.current = seen;
    };

    const send = () => {
      if (sent.current) return;
      sent.current = true;
      measure();
      track(scrollEvent(deepest.current));
    };

    const onHide = () => {
      if (document.visibilityState === "hidden") send();
    };

    // Once up front: a screen that fits without scrolling fires no scroll
    // event, and would otherwise be recorded as if nobody looked at it.
    measure();

    window.addEventListener("scroll", measure, { passive: true });
    // The page gets taller as the lazy hero art and the upload cards settle,
    // and a reading taken against the old height would be an overestimate.
    window.addEventListener("resize", measure, { passive: true });
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", send);

    return () => {
      window.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", send);
      // Deferred by a tick so the re-mount above can cancel it. A genuine
      // unmount - advancing past the upload step - has no re-mount to cancel
      // it, so the reading still goes. Leaving the page entirely does not rely
      // on this at all: the two listeners have already sent, synchronously.
      departure.current = window.setTimeout(send, 0);
    };
  }, []);

  return null;
}
