"use client";

import type { FunnelEvent } from "./funnel";

/**
 * Recording a step, from the customer's browser.
 *
 * The visit id is made here and kept in sessionStorage: it lasts one visit,
 * belongs to nobody, and is thrown away when the tab closes. It exists so the
 * dashboard can count "visits that reached step three" rather than "times step
 * three was rendered" - a customer who taps back and forward is one visit, not
 * four. Nothing about them is stored beside it.
 *
 * sendBeacon where it exists, because the most interesting step is often the
 * last thing a browser does before navigating away, and an ordinary fetch is
 * cancelled at exactly that moment.
 */

const KEY = "snipsavor.visit";

function visitId(): string | null {
  try {
    const existing = sessionStorage.getItem(KEY);
    if (existing) return existing;

    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    const created = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    sessionStorage.setItem(KEY, created);
    return created;
  } catch {
    // Private mode, or storage switched off. Counting stops; nothing else does.
    return null;
  }
}

/**
 * @param areaId Sent from the area step onwards, once the customer has said
 *   where they are. It is the only attribute attached to a visit, and it is one
 *   they volunteered from a fixed list of Dubai districts - coarse enough to
 *   identify nobody, specific enough to say which areas stop converting.
 */
export function track(event: FunnelEvent, token?: string, areaId?: string | null): void {
  if (typeof window === "undefined") return;

  try {
    const id = visitId();
    if (!id) return;

    const body = JSON.stringify({ event, visitId: id, token, areaId: areaId || undefined });

    if (typeof navigator.sendBeacon === "function") {
      navigator.sendBeacon("/api/events", new Blob([body], { type: "application/json" }));
      return;
    }

    void fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Never the reason a screen fails.
  }
}
