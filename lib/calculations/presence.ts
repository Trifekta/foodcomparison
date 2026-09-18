import { FUNNEL_STEPS } from "@/lib/analytics/funnel";

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
}

export interface LivePresenceSummary {
  /** Distinct visits seen within the active window. */
  activeCount: number;
  /** Active visits with no step yet - on the site, but too early to say where. */
  arrivedCount: number;
  /** Only steps somebody is currently on, in funnel order. */
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
  // rows happened to come back.
  const byStep = FUNNEL_STEPS.map((step) => ({
    event: step.event,
    label: step.label,
    count: counts.get(step.event) ?? 0,
  })).filter((step) => step.count > 0);

  return { activeCount: active.length, arrivedCount, byStep };
}
