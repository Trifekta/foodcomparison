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
  submissions: { reference_number: string; utm_source: string | null; utm_campaign: string | null; utm_content: string | null } | null;
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
  /**
   * A visit that opened an order's result (or tapped through to Keeta) without
   * ever sending one - somebody following the link from an order placed on an
   * earlier day, which is a real visit today and not an order today.
   */
  returning: boolean;
  areaName: string | null;
  reference: string | null;
  /** Whether this visit ever sent an order. */
  completed: boolean;
  /** UTM source from the landing page. */
  utmSource: string | null;
  /** UTM campaign from the landing page. */
  utmCampaign: string | null;
  /** UTM content (ad/creative) from the landing page. */
  utmContent: string | null;
}

const ORDER = new Map<string, number>(FUNNEL_STEPS.map((step, index) => [step.event, index]));
const LABELS = new Map<string, string>(FUNNEL_STEPS.map((step) => [step.event, step.label]));

/** The step everything else is measured against - sending the order. */
export const COMPLETED_EVENT = "submitted";

/**
 * Where the ladder stops being a ladder.
 *
 * Every step up to and including this one happens in the visit that makes the
 * order. The two above it - opening the result, tapping through to Keeta -
 * happen whenever the customer next reads their WhatsApp message, which is
 * routinely the following day and always a new visit id. So for those two, and
 * only those two, "furthest step reached" does not imply the steps below it.
 */
const COMPLETED_INDEX = ORDER.get(COMPLETED_EVENT) ?? Infinity;

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
    let sentOrder = false;
    let areaName: string | null = null;
    let reference: string | null = null;
    let utmSource: string | null = null;
    let utmCampaign: string | null = null;
    let utmContent: string | null = null;

    for (const row of events) {
      if (row.created_at < firstSeen) firstSeen = row.created_at;
      if (row.created_at > lastSeen) lastSeen = row.created_at;

      if (row.event === "cart_uploaded") screenshots += 1;
      if (row.event === COMPLETED_EVENT) sentOrder = true;

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
      // Attribution fields are also resolved from the submission when available
      if (!utmSource && row.submissions?.utm_source) {
        utmSource = row.submissions.utm_source;
      }
      if (!utmCampaign && row.submissions?.utm_campaign) {
        utmCampaign = row.submissions.utm_campaign;
      }
      if (!utmContent && row.submissions?.utm_content) {
        utmContent = row.submissions.utm_content;
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
      // Read off the event itself rather than off the ladder position. A visit
      // whose furthest step is "Opened their result" outranks "Sent the order"
      // without having sent one, and counting it as a completion is what put
      // yesterday's orders in today's total.
      returning: !sentOrder && furthestIndex > COMPLETED_INDEX,
      areaName,
      reference,
      completed: sentOrder,
      utmSource,
      utmCampaign,
      utmContent,
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

/**
 * The two questions a step filter can be asked, which are not the same one.
 *
 * "reached" is funnel volume: how many got this far, wherever they ended up.
 * "stopped" is where people die: the visits whose furthest point IS this step
 * and went no further. Picking "Opened the wizard" under "reached" correctly
 * returns somebody who went on to send an order, which reads as a broken
 * filter unless the page says which question it is answering - so the control
 * is explicit rather than implied by a label nobody reads.
 */
export type StepMatch = "reached" | "stopped";

export const STEP_MATCHES: StepMatch[] = ["reached", "stopped"];

export function isStepMatch(value: string | null): value is StepMatch {
  return value === "reached" || value === "stopped";
}

/** Keeps the visits that reached the given step, or that stopped on it. */
export function filterByStep(
  summaries: VisitSummary[],
  event: string | null,
  match: StepMatch = "reached",
): VisitSummary[] {
  if (!event) return summaries;
  const index = ORDER.get(event);
  if (index === undefined) return summaries;
  if (match === "stopped") return summaries.filter((visit) => visit.furthestIndex === index);

  // "At least as far as" credits a visit with the steps below the one it
  // reached, because those are steps it must have walked through. That does
  // not hold for a visit that only came back to an already-sent order: it
  // reached the result without ever sending anything, so it answers "got as
  // far as Opened their result" and not "got as far as Sent the order".
  return summaries.filter(
    (visit) => visit.furthestIndex >= index && !(visit.returning && index <= COMPLETED_INDEX),
  );
}
