import { FUNNEL_STEPS, SIDE_EVENTS } from "@/lib/analytics/funnel";

/**
 * Turning visit_presence rows into the numbers the live admin view shows.
 *
 * Kept as a pure function over rows, same as the validation metrics, so the
 * one-line question - "who counts as active right now" - is a rule in one
 * place and testable without a database or a clock nobody controls.
 */

export interface PresenceRow {
  visit_id: string;
  last_seen_at: string;
  /** Null means a heartbeat arrived before any funnel step did. */
  last_event: string | null;
}

export interface LiveStepCount {
  event: string;
  label: string;
  count: number;
  /** A funnel rung, or one of the detours beside it - see SIDE_EVENTS. */
  kind: "step" | "side";
}

export interface LivePresenceSummary {
  /** Distinct visits seen within the active window. */
  activeCount: number;
  /** Active visits with no step yet - on the site, but too early to say where. */
  arrivedCount: number;
  /**
   * Where the active visits are, funnel rungs first and detours after.
   *
   * Only what somebody is actually on - an empty step is left out. Together
   * with arrivedCount these always account for every active visit, so the
   * chips add up to activeCount rather than trailing it.
   */
  byStep: LiveStepCount[];
}

/**
 * How long since a heartbeat or a real step before a visit stops counting as
 * "here". The browser sends a heartbeat every 20 seconds while the tab is
 * visible (see lib/analytics/track.ts), so two minutes survives several missed
 * beats - a slow network or a backgrounded tab - without still counting
 * somebody who closed the tab five minutes ago.
 */
export const ACTIVE_WINDOW_MS = 2 * 60_000;

export function summarizeLivePresence(
  rows: PresenceRow[],
  now: number = Date.now(),
  activeWindowMs: number = ACTIVE_WINDOW_MS,
): LivePresenceSummary {
  const active = rows.filter((row) => now - Date.parse(row.last_seen_at) < activeWindowMs);

  const counts = new Map<string, number>();
  let arrivedCount = 0;
  for (const row of active) {
    if (!row.last_event) {
      arrivedCount += 1;
      continue;
    }
    counts.set(row.last_event, (counts.get(row.last_event) ?? 0) + 1);
  }

  // FUNNEL_STEPS order, not insertion order - so the live view reads as a
  // funnel (arrived, then basket, then where, ...) rather than however the
  // rows happened to come back. The detours follow the rungs for the same
  // reason: they are not progress, and interleaving them by event name would
  // put "went to a food app" between two steps as though it were one.
  const byStep: LiveStepCount[] = [];
  const take = (event: string, label: string, kind: "step" | "side") => {
    const count = counts.get(event);
    if (!count) return;
    // Taken rather than read, so whatever is left below is exactly the set
    // neither list names.
    counts.delete(event);
    byStep.push({ event, label, count, kind });
  };

  for (const step of FUNNEL_STEPS) take(step.event, step.label, "step");
  // SIDE_EVENTS too, not FUNNEL_STEPS alone. A visit whose latest event is a
  // detour - the example link, a food-app tile, a scroll depth - is on the
  // site and counted in activeCount, and listing only the rungs left it in no
  // chip at all: the headline said 2 and the chips beneath it said 1.
  for (const side of SIDE_EVENTS) take(side.event, side.label, "side");

  // Anything neither list names - a row recorded under an event since renamed,
  // say. Shown under its own name rather than dropped, because the point of
  // the two loops above is that every active visit appears exactly once, and
  // silently losing the unrecognised ones would reopen the same gap. Sorted so
  // the order does not depend on how the rows came back.
  for (const event of [...counts.keys()].sort()) {
    byStep.push({ event, label: event, count: counts.get(event) ?? 0, kind: "side" });
  }

  return { activeCount: active.length, arrivedCount, byStep };
}
