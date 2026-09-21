"use client";

import { VISIT_ID_PATTERN, type FunnelEvent, type SideEvent } from "./funnel";
import { dubaiIsoDate } from "@/lib/utils/text";

/**
 * Recording a step, from the customer's browser.
 *
 * The visit id is made here and kept for the rest of the Dubai day: it belongs
 * to nobody, and it is replaced by a fresh random value at midnight. It exists
 * so the dashboard can count "visits that reached step three" rather than
 * "times step three was rendered" - a customer who taps back and forward, or
 * closes the tab and opens the link again an hour later, is one visit and not
 * four. Nothing about them is stored beside it.
 *
 * sendBeacon where it exists, because the most interesting step is often the
 * last thing a browser does before navigating away, and an ordinary fetch is
 * cancelled at exactly that moment.
 */

const KEY = "snipsavor.visit";

/**
 * The id for today, made on first use.
 *
 * Two things about the lifetime, and both are deliberate.
 *
 * localStorage rather than sessionStorage, because sessionStorage is per tab:
 * the same person opening the WhatsApp link, going back to Instagram and
 * tapping through again was three visits, three rows, and three separate
 * denominators in the funnel. One person on one day is one visit.
 *
 * Stamped with the Dubai day rather than given a rolling 24-hour life, because
 * the dashboard's every window is a Dubai calendar day. An id that outlived
 * midnight would put one person's morning and the previous evening in the same
 * visit, whose events then straddle two of those windows - the row would appear
 * under both days with its screenshots divided between them. Expiring on the
 * day boundary is what makes "one row per person per day" true rather than
 * nearly true.
 *
 * Exported as well as used here, because the outbound Keeta link carries it in
 * its query string: the click is recorded server-side, where this storage is
 * not readable, and without it the report can count taps but not the people
 * making them. It is the same value the funnel already uses, so "visits that
 * reached the result" and "visits that switched" are the same kind of number.
 */

interface StoredVisit {
  id: string;
  /** The Dubai calendar day this id was made on, YYYY-MM-DD. */
  day: string;
}

/** Whatever is in storage, if it is still today's and still looks like an id. */
function storedVisit(today: string): string | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;

  try {
    const stored = JSON.parse(raw) as Partial<StoredVisit> | null;
    if (!stored || stored.day !== today) return null;
    return typeof stored.id === "string" && VISIT_ID_PATTERN.test(stored.id) ? stored.id : null;
  } catch {
    // Something else wrote here, or a half-written value survived a crash.
    // Treated as no id at all, so the line below replaces it - throwing from
    // here instead would leave the bad value in place and stop this browser
    // being counted again, permanently.
    return null;
  }
}

export function visitId(): string | null {
  try {
    const today = dubaiIsoDate();
    const existing = storedVisit(today);
    if (existing) return existing;

    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    const created = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    localStorage.setItem(KEY, JSON.stringify({ id: created, day: today } satisfies StoredVisit));
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
