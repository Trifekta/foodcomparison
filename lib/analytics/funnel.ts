/**
 * The steps worth counting between an advert and a Keeta basket.
 *
 * Shared by the browser that records them and the dashboard that reads them, so
 * the two can never disagree about what a step is called. The order here is the
 * order of the funnel, and the dashboard renders it in this order.
 */

export const FUNNEL_STEPS = [
  { event: "wizard_started", label: "Opened the wizard" },
  { event: "step_basket", label: "Confirmed their basket" },
  { event: "step_where", label: "Gave area and total" },
  { event: "step_review", label: "Reached review" },
  { event: "submitted", label: "Sent the order" },
  { event: "result_viewed", label: "Opened their result" },
  { event: "keeta_opened", label: "Tapped through to Keeta" },
] as const;

export type FunnelEvent = (typeof FUNNEL_STEPS)[number]["event"];

const EVENTS = new Set<string>(FUNNEL_STEPS.map((step) => step.event));

export function isFunnelEvent(value: string): value is FunnelEvent {
  return EVENTS.has(value);
}

/** Matches the database's own check, so a bad id is refused before the query. */
export const VISIT_ID_PATTERN = /^[0-9a-f]{16,32}$/;

export function isValidVisitId(value: string): boolean {
  return VISIT_ID_PATTERN.test(value);
}

export interface FunnelRow {
  event: string;
  visit_id: string;
}

export interface FunnelStepCount {
  event: FunnelEvent;
  label: string;
  /** Distinct visits that reached this step. */
  count: number;
  /** Share of the visits that opened the wizard at all, 0-100. */
  shareOfStart: number;
  /** Share of the step above it, which is where a screen loses people. */
  shareOfPrevious: number;
  /** Visits that got this far and no further, as a share of the step above. */
  dropFromPrevious: number;
}

/**
 * Counts VISITS, not events.
 *
 * Somebody who steps back and forward records a step twice, and a funnel that
 * counted those twice would say more people reached step three than started.
 * Distinct visit ids are the honest measure of "how many got this far".
 */
export function computeFunnel(rows: FunnelRow[]): FunnelStepCount[] {
  const visitsByEvent = new Map<string, Set<string>>();
  for (const row of rows) {
    const visits = visitsByEvent.get(row.event) ?? new Set<string>();
    visits.add(row.visit_id);
    visitsByEvent.set(row.event, visits);
  }

  const started = visitsByEvent.get("wizard_started")?.size ?? 0;
  let previous = 0;

  return FUNNEL_STEPS.map((step, index) => {
    const count = visitsByEvent.get(step.event)?.size ?? 0;
    const shareOfStart = started > 0 ? (count / started) * 100 : 0;
    const shareOfPrevious = index === 0 ? 100 : previous > 0 ? (count / previous) * 100 : 0;
    const dropFromPrevious = index === 0 ? 0 : Math.max(0, 100 - shareOfPrevious);
    previous = count;

    return { event: step.event, label: step.label, count, shareOfStart, shareOfPrevious, dropFromPrevious };
  });
}
