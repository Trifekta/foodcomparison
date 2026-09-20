import { FUNNEL_STEPS, type FunnelEvent } from "@/lib/analytics/funnel";

/**
 * One row per visit, from the events that visit recorded.
 *
 * The funnel says how many reached each step; this says what one person did -
 * which is the question "how many screenshots does somebody upload" needs, and
 * the funnel cannot answer because it counts distinct visits per step and so
 * flattens three uploads by one person into one.
 *
 * Pure over rows, like every other calculation here, so the rules that decide
 * "furthest step" and "how many uploads" are testable without a database.
 */

export interface VisitEventRow {
  visit_id: string;
  event: string;
  created_at: string;
  areas: { name: string } | null;
  submissions: { reference_number: string } | null;
}

export interface VisitSummary {
  visitId: string;
  firstSeen: string;
  lastSeen: string;
  /** How many times a cart screenshot was picked, retries included. */
  screenshots: number;
  /** The furthest point reached, by FUNNEL_STEPS order. Null if nothing known. */
  furthestEvent: FunnelEvent | null;
  furthestLabel: string;
  /** How far along the funnel that is, for filtering. -1 when unknown. */
  furthestIndex: number;
  areaName: string | null;
  reference: string | null;
  /** Whether this visit ever sent an order. */
  completed: boolean;
}

const ORDER = new Map<string, number>(FUNNEL_STEPS.map((step, index) => [step.event, index]));
const LABELS = new Map<string, string>(FUNNEL_STEPS.map((step) => [step.event, step.label]));

/** The step everything else is measured against - sending the order. */
export const COMPLETED_EVENT = "submitted";

export function summarizeVisits(rows: VisitEventRow[]): VisitSummary[] {
  const byVisit = new Map<string, VisitEventRow[]>();
  for (const row of rows) {
    const existing = byVisit.get(row.visit_id);
    if (existing) existing.push(row);
    else byVisit.set(row.visit_id, [row]);
  }

  const summaries: VisitSummary[] = [];

  for (const [visitId, events] of byVisit) {
    let firstSeen = events[0].created_at;
    let lastSeen = events[0].created_at;
    let screenshots = 0;
    let furthestIndex = -1;
    let furthestEvent: FunnelEvent | null = null;
    let areaName: string | null = null;
    let reference: string | null = null;

    for (const row of events) {
      if (row.created_at < firstSeen) firstSeen = row.created_at;
      if (row.created_at > lastSeen) lastSeen = row.created_at;

      if (row.event === "cart_uploaded") screenshots += 1;

      const index = ORDER.get(row.event);
      if (index !== undefined && index > furthestIndex) {
        furthestIndex = index;
        furthestEvent = row.event as FunnelEvent;
      }

      // Resolved from whichever event carries one, because the early events in
      // a visit are recorded before the customer has said where they are.
      if (!areaName && row.areas?.name) areaName = row.areas.name;
      if (!reference && row.submissions?.reference_number) {
        reference = row.submissions.reference_number;
      }
    }

    summaries.push({
      visitId,
      firstSeen,
      lastSeen,
      screenshots,
      furthestEvent,
      furthestLabel: furthestEvent ? (LABELS.get(furthestEvent) ?? furthestEvent) : "—",
      furthestIndex,
      areaName,
      reference,
      completed: (ORDER.get(COMPLETED_EVENT) ?? Infinity) <= furthestIndex,
    });
  }

  // Newest first, the way every other list in the dashboard reads.
  return summaries.sort((a, b) => (a.lastSeen < b.lastSeen ? 1 : a.lastSeen > b.lastSeen ? -1 : 0));
}

export interface VisitTotals {
  visits: number;
  uploaded: number;
  completed: number;
  /** Screenshots picked across every visit, retries included. */
  screenshots: number;
}

export function totalVisits(summaries: VisitSummary[]): VisitTotals {
  return {
    visits: summaries.length,
    uploaded: summaries.filter((visit) => visit.screenshots > 0).length,
    completed: summaries.filter((visit) => visit.completed).length,
    screenshots: summaries.reduce((sum, visit) => sum + visit.screenshots, 0),
  };
}

/** Keeps only the visits that got at least as far as the given step. */
export function filterByStep(summaries: VisitSummary[], event: string | null): VisitSummary[] {
  if (!event) return summaries;
  const index = ORDER.get(event);
  if (index === undefined) return summaries;
  return summaries.filter((visit) => visit.furthestIndex >= index);
}
