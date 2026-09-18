"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Keeps the live page current without anybody hitting reload.
 *
 * router.refresh() re-runs the server component in place - same query, same
 * page, new data - which is enough here: this page is read, not edited, so
 * there is no local state a refetch could clobber the way it would on a form.
 * Paused on a hidden tab so an admin with this open in a background tab is not
 * quietly hammering the database for a screen nobody is looking at.
 */
const REFRESH_MS = 15_000;

export function LiveAutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = setInterval(tick, REFRESH_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router]);

  return null;
}
