import { FUNNEL_STEP_LABELS, type FunnelRow } from "@/lib/analytics/funnel";
import { SCROLL_EVENTS } from "@/lib/analytics/scroll";
import type { CountByLabel } from "@/lib/calculations/analytics";

/**
 * How far visits got down the upload screen.
 *
 * Reads the rows the funnel already fetched - scroll marks live in the same
 * table - so the dashboard pays nothing extra to show this.
 *
 * Counts VISITS, not events, and takes the deepest mark each visit recorded.
 * A visit can post two: stepping back to the upload screen from the basket
 * screen remounts the tracker, and a second, possibly shallower reading is
 * not a second visit and must not be able to drag the first one down.
 */
export function scrollDepthDistribution(rows: FunnelRow[]): {
  items: CountByLabel[];
  visits: number;
} {
  const rank = new Map(SCROLL_EVENTS.map((event, index) => [event as string, index]));
  const deepestByVisit = new Map<string, number>();

  for (const row of rows) {
    const index = rank.get(row.event);
    if (index === undefined) continue;
    const seen = deepestByVisit.get(row.visit_id);
    if (seen === undefined || index > seen) deepestByVisit.set(row.visit_id, index);
  }

  const counts = new Array<number>(SCROLL_EVENTS.length).fill(0);
  for (const index of deepestByVisit.values()) counts[index] += 1;

  return {
    items: SCROLL_EVENTS.map((event, index) => ({
      label: FUNNEL_STEP_LABELS[event] ?? event,
      count: counts[index],
    })),
    visits: deepestByVisit.size,
  };
}
