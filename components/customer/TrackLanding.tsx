"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics/track";

/**
 * Records that somebody arrived.
 *
 * The landing page is a server component and should stay one - it is the first
 * paint of an advert click, and the less that has to run before it appears the
 * better. So the one thing here that needs a browser is split into its own
 * component, which renders nothing.
 *
 * This is the step the whole funnel hangs from. Every other number is a share
 * of the people who got here, and until now the count started at the wizard -
 * so the money spent on everyone who looked at this page and left was invisible.
 */
export function TrackLanding() {
  useEffect(() => {
    track("landing_viewed");
  }, []);

  return null;
}
