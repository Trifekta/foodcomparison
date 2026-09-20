import type { SideEvent } from "./funnel";

/**
 * How far down a screen somebody actually got.
 *
 * One reading per visit, bucketed, because funnel_events stores an event name
 * and nothing else - and because the question this answers is coarse. The
 * upload step puts its "No screenshot yet?" card at 788px on a page of about
 * 1820, against a fold near 750: what needs settling is whether the people who
 * leave without uploading ever scrolled far enough to see it, and a quarter of
 * a screen is a fine enough ruler for that.
 *
 * Deliberately NOT a click or pointer heatmap. That needs a recorder in the
 * customer's browser, and this bundle already lazy-loads an OCR engine on the
 * same screen; another hundred kilobytes on the flow we are trying to stop
 * people abandoning would cost more than the measurement is worth.
 */

/** Descending: the first bucket a reading satisfies is the deepest it reached. */
const BUCKETS = [100, 75, 50, 25, 0] as const;

export type ScrollBucket = (typeof BUCKETS)[number];

/**
 * Checked against SideEvent, so adding a bucket without adding its event to
 * SIDE_EVENTS fails to compile rather than posting something the server drops.
 */
const EVENT_BY_BUCKET = {
  100: "scroll_100",
  75: "scroll_75",
  50: "scroll_50",
  25: "scroll_25",
  0: "scroll_0",
} as const satisfies Record<ScrollBucket, SideEvent>;

/** Shallowest first, for a distribution that reads top to bottom. */
export const SCROLL_EVENTS: SideEvent[] = [...BUCKETS].reverse().map((b) => EVENT_BY_BUCKET[b]);

/**
 * The share of the page that has been on screen, 0-100.
 *
 * Measured to the BOTTOM of the viewport, not the top: somebody at scrollY 0
 * on a phone has already seen the first screenful, and calling that 0% would
 * report every short visit as having seen nothing.
 */
export function percentSeen(
  scrollY: number,
  viewportHeight: number,
  pageHeight: number,
): number {
  // A page no taller than the screen was seen in full by arriving on it.
  if (pageHeight <= 0 || pageHeight <= viewportHeight) return 100;
  // Clamped going IN, not just coming out. iOS rubber-banding reports a
  // negative scrollY while somebody pulls down at the top, and subtracting
  // that from the screenful they can plainly see understates the reading -
  // which lands wrong exactly where it matters, since the card this measures
  // sits a shade under halfway and a nudge either side changes the bucket.
  const from = Math.max(0, scrollY);
  return Math.min(100, ((from + viewportHeight) / pageHeight) * 100);
}

export function scrollBucket(percent: number): ScrollBucket {
  return BUCKETS.find((bucket) => percent >= bucket) ?? 0;
}

/** The event name to record for a reading. Every reading has one, 0 included. */
export function scrollEvent(percent: number): SideEvent {
  return EVENT_BY_BUCKET[scrollBucket(percent)];
}
