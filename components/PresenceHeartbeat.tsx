"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { heartbeat } from "@/lib/analytics/track";

/**
 * Keeps a visit's last_seen_at current for as long as its tab stays open.
 *
 * Mounted once, in the root layout, so it covers every customer-facing page
 * without each of them wiring it up separately - and skips /admin, because the
 * "who is on the site" count exists for the admin to watch, not to watch
 * themselves back.
 */
const INTERVAL_MS = 20_000;

export function PresenceHeartbeat() {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin") ?? false;

  useEffect(() => {
    if (isAdmin) return;

    heartbeat();
    const timer = setInterval(() => {
      // A background tab is not "here" in any sense the live view means.
      if (document.visibilityState === "visible") heartbeat();
    }, INTERVAL_MS);

    // Coming back to the tab is worth an immediate beat rather than waiting
    // out whatever was left of the interval.
    const onVisible = () => {
      if (document.visibilityState === "visible") heartbeat();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [isAdmin]);

  return null;
}
