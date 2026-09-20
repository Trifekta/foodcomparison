/**
 * The steps worth counting between an advert and a Keeta basket.
 *
 * Shared by the browser that records them and the dashboard that reads them, so
 * the two can never disagree about what a step is called. The order here is the
 * order of the funnel, and the dashboard renders it in this order.
 */

export const FUNNEL_STEPS = [
  // The advert lands here. Counting from the wizard instead would hide the
  // most expensive drop there is: people who were paid for, arrived, and left
  // without starting.
  { event: "landing_viewed", label: "Landed from the advert" },
  { event: "wizard_started", label: "Opened the wizard" },
  // Fires the instant a cart screenshot is picked, not when its read
  // finishes or when they continue past it - a visit that uploads and then
  // walks away is what step_basket alone can never tell apart from a visit
  // that never uploaded at all.
  { event: "cart_uploaded", label: "Uploaded a screenshot" },
  // Each of these fires on ARRIVAL at a screen, so the honest label is the
  // thing the customer just finished, not the screen they are now looking at.
  // They used to be named one step ahead of themselves - "Gave area and total"
  // sat on the event that fires the moment somebody *reaches* the area screen,
  // having given nothing - which read as a far warmer funnel than the real one.
  { event: "step_basket", label: "Reached the basket screen" },
  { event: "step_where", label: "Confirmed their basket" },
  { event: "step_review", label: "Gave area and total" },
  { event: "submitted", label: "Sent the order" },
  { event: "result_viewed", label: "Opened their result" },
  { event: "keeta_opened", label: "Tapped through to Keeta" },
] as const;

export type FunnelEvent = (typeof FUNNEL_STEPS)[number]["event"];

const EVENTS = new Set<string>(FUNNEL_STEPS.map((step) => step.event));

export function isFunnelEvent(value: string): value is FunnelEvent {
  return EVENTS.has(value);
}

/**
 * Things worth recording that are not steps.
 *
 * Deliberately outside FUNNEL_STEPS. Leaving for a food app is a detour, not a
 * rung: most visits never do it, so slotting it into the ladder would divide
 * cart_uploaded by a near-empty step and report a drop that did not happen -
 * computeFunnel measures each step against the one above it. Kept here instead,
 * these are stored and shown by name in the live view, and every calculation
 * that walks FUNNEL_STEPS steps straight past them.
 */
export const SIDE_EVENTS = [
  { event: "app_opened", label: "Went to a food app" },
  // How far down the upload screen they got, one per visit. Buckets rather
  // than a number because this table stores event names and nothing else, and
  // a quarter of a screen is as fine a reading as the question needs: the
  // question is "did anybody see the card below the fold", not "by how many
  // pixels did they miss it".
  { event: "scroll_0", label: "Saw the top only" },
  { event: "scroll_25", label: "Scrolled a quarter" },
  { event: "scroll_50", label: "Scrolled halfway" },
  { event: "scroll_75", label: "Scrolled three quarters" },
  { event: "scroll_100", label: "Reached the bottom" },
] as const;

export type SideEvent = (typeof SIDE_EVENTS)[number]["event"];

const SIDE = new Set<string>(SIDE_EVENTS.map((side) => side.event));

export function isSideEvent(value: string): value is SideEvent {
  return SIDE.has(value);
}

/** Anything the browser may record: a funnel step, or one of the detours above. */
export function isTrackedEvent(value: string): value is FunnelEvent | SideEvent {
  return EVENTS.has(value) || SIDE.has(value);
}

/** A step's label, for anywhere that only has the event name - the live view included. */
export const FUNNEL_STEP_LABELS: Record<string, string> = Object.fromEntries(
  [...FUNNEL_STEPS, ...SIDE_EVENTS].map((step) => [step.event, step.label]),
);

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

  // The baseline is whatever step comes first, read from the list rather than
  // named here. It was hardcoded to "wizard_started", so when the landing page
  // was added above it every share was quietly measured against the wrong
  // denominator - and the new first step reported 100% of itself.
  const started = visitsByEvent.get(FUNNEL_STEPS[0].event)?.size ?? 0;
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


/**
 * The steps an area can be judged on.
 *
 * Everything before the area step is excluded on purpose. A visit that stopped
 * on the upload screen never said where it was, so counting it under any area
 * would be inventing a number - and counting it under "unknown" beside the real
 * areas would make every area look better than it is.
 */
export const AREA_FUNNEL_STEPS = FUNNEL_STEPS.filter((step) =>
  ["step_where", "step_review", "submitted", "result_viewed", "keeta_opened"].includes(step.event),
);

export interface FunnelAreaRow {
  event: string;
  visit_id: string;
  areas: { name: string } | null;
}

export interface AreaFunnelCount {
  area: string;
  /** Visits from this area that reached each step, in AREA_FUNNEL_STEPS order. */
  counts: number[];
  /** Of the visits that gave this area, the share that tapped through to Keeta. */
  conversion: number;
}

/**
 * How far visits from each area got.
 *
 * A visit's area is resolved once, from whichever of its events carries one,
 * and then all of that visit's steps are counted under it. Reading the area off
 * each event separately would drop any step recorded before the customer said
 * where they were, and would double-count a visit that somehow reported two.
 *
 * Sorted by the widest step, so the areas sending the most people come first -
 * an area with one visit and a 100% conversion is noise, and putting it at the
 * top would be the most misleading way to order this.
 */
export function computeAreaFunnel(rows: FunnelAreaRow[]): AreaFunnelCount[] {
  const areaOfVisit = new Map<string, string>();
  for (const row of rows) {
    const name = row.areas?.name?.trim();
    if (name && !areaOfVisit.has(row.visit_id)) areaOfVisit.set(row.visit_id, name);
  }

  // area -> event -> the visits from that area that reached it
  const byArea = new Map<string, Map<string, Set<string>>>();
  for (const row of rows) {
    const area = areaOfVisit.get(row.visit_id);
    if (!area) continue;

    const events = byArea.get(area) ?? new Map<string, Set<string>>();
    const visits = events.get(row.event) ?? new Set<string>();
    visits.add(row.visit_id);
    events.set(row.event, visits);
    byArea.set(area, events);
  }

  const result: AreaFunnelCount[] = [];
  for (const [area, events] of byArea) {
    const counts = AREA_FUNNEL_STEPS.map((step) => events.get(step.event)?.size ?? 0);
    const reached = counts[0] ?? 0;
    const converted = counts[counts.length - 1] ?? 0;
    result.push({
      area,
      counts,
      conversion: reached > 0 ? (converted / reached) * 100 : 0,
    });
  }

  return result.sort((a, b) => b.counts[0] - a.counts[0] || a.area.localeCompare(b.area));
}
