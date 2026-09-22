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

/** One row of visitor_ips, as stored. */
export interface VisitIpRow {
  visit_id: string;
  client_ip: string;
  created_at: string;
  submissions: { reference_number: string } | null;
}

/** A visit with both its IP and what the funnel saw it do. */
export interface ValidationRow {
  visit_id: string;
  client_ip: string;
  /**
   * How many visits in this range came from this IP.
   *
   * The column the rest of this report exists for. A visit id is one browser
   * for one Dubai day, so anybody in an in-app browser - which is most ad
   * traffic - can produce a fresh one every time they tap the ad. Three visit
   * ids behind one IP is one person retrying, and the per-visit table reads
   * that as three people with no way to tell the difference.
   *
   * It errs the other way too, and knowing which way matters: carriers here
   * put many subscribers behind one address, so a shared IP is evidence and
   * not proof. Visit count is the ceiling on how many people there were, this
   * is the floor.
   */
  visits_from_ip: number;
  created_at: string;
  first_seen: string | null;
  last_seen: string | null;
  screenshots: number;
  furthest_step: string;
  area: string | null;
  converted: boolean;
  reference_number: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
}

/**
 * The IP rows joined to the funnel's own view of each visit.
 *
 * The IP rows are the spine: one per visit, written on that visit's first
 * event. A visit that somehow recorded no funnel events still appears, with
 * its step columns empty, because a row that vanishes from an audit export is
 * worse than one that admits it knows nothing.
 */
export function mergeValidationRows(
  ips: VisitIpRow[],
  summaries: VisitSummary[],
): ValidationRow[] {
  const byVisit = new Map(summaries.map((visit) => [visit.visitId, visit]));

  const perIp = new Map<string, number>();
  for (const row of ips) {
    perIp.set(row.client_ip, (perIp.get(row.client_ip) ?? 0) + 1);
  }

  const rows = ips.map((row) => {
    const visit = byVisit.get(row.visit_id);
    // Either source will do. visitor_ips learns the submission on the event
    // that created it; funnel_events carries it on the same event. Taking
    // whichever has it means one missed upsert does not file a real order as
    // an abandoned visit.
    const reference = row.submissions?.reference_number ?? visit?.reference ?? null;

    return {
      visit_id: row.visit_id,
      client_ip: row.client_ip,
      visits_from_ip: perIp.get(row.client_ip) ?? 1,
      created_at: row.created_at,
      first_seen: visit?.firstSeen ?? null,
      last_seen: visit?.lastSeen ?? null,
      screenshots: visit?.screenshots ?? 0,
      furthest_step: visit?.furthestLabel ?? "—",
      area: visit?.areaName ?? null,
      converted: reference !== null,
      reference_number: reference,
      utm_source: visit?.utmSource ?? null,
      utm_campaign: visit?.utmCampaign ?? null,
      utm_content: visit?.utmContent ?? null,
    };
  });

  // Busiest addresses first, each one's visits kept together and in order.
  // The repeat sessions this report exists to find end up adjacent at the top,
  // rather than scattered down a file sorted by time.
  return rows.sort(
    (a, b) =>
      b.visits_from_ip - a.visits_from_ip ||
      (a.client_ip < b.client_ip ? -1 : a.client_ip > b.client_ip ? 1 : 0) ||
      (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0),
  );
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
