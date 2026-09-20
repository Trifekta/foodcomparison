"use client";

import type { FunnelEvent, SideEvent } from "./funnel";

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

/**
 * The id for this visit, made on first use.
 *
 * Exported as well as used here, because the outbound Keeta link carries it in
 * its query string: the click is recorded server-side, where sessionStorage is
 * not readable, and without it the report can count taps but not the people
 * making them. It is the same value the funnel already uses, so "visits that
 * reached the result" and "visits that switched" are the same kind of number.
 */

export function visitId(): string | null {
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

/** sendBeacon where it exists, an ordinary keepalive fetch where it does not. */
function send(body: string): void {
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
}

/**
 * @param areaId Sent from the area step onwards, once the customer has said
 *   where they are. It is the only attribute attached to a visit, and it is one
 *   they volunteered from a fixed list of Dubai districts - coarse enough to
 *   identify nobody, specific enough to say which areas stop converting.
 */
export function track(
  event: FunnelEvent | SideEvent,
  token?: string,
  areaId?: string | null,
): void {
  if (typeof window === "undefined") return;

  try {
    const id = visitId();
    if (!id) return;

    send(JSON.stringify({ event, visitId: id, token, areaId: areaId || undefined }));
  } catch {
    // Never the reason a screen fails.
  }
}

/**
 * A pulse, not a step.
 *
 * The funnel only records when somebody moves between screens, never while
 * they sit on one - so a visit reading the review step for two minutes looks,
 * to funnel_events, identical to one that closed the tab. This is what tells
 * the admin's live view "still here": sent once on mount and then every
 * HEARTBEAT_INTERVAL_MS while the tab is visible, from PresenceHeartbeat.
 */
export function heartbeat(): void {
  if (typeof window === "undefined") return;

  try {
    const id = visitId();
    if (!id) return;

    send(JSON.stringify({ event: "heartbeat", visitId: id }));
  } catch {
    // Never the reason a screen fails.
  }
}
