import { FUNNEL_STEPS, FUNNEL_STEP_LABELS, type FunnelEvent } from "@/lib/analytics/funnel";

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
  /**
   * The last event recorded, in time order rather than ladder order.
   *
   * Not the same question as furthestEvent, and the difference is the whole
   * point: leaving for a food app is a detour off the ladder, so the visit's
   * furthest RUNG is still whatever it was, while the last thing it actually
   * did is app_opened. Only this can tell "went to fetch a screenshot" apart
   * from "stopped".
   */
  lastEvent: string | null;
  /** Every event in the order it happened, consecutive repeats collapsed. */
  path: string[];
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

  for (const [visitId, unordered] of byVisit) {
    // The query hands these back newest first. Everything below reads the same
    // either way except the path, which is only a path in time order.
    const events = [...unordered].sort((a, b) =>
      a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0,
    );

    let firstSeen = events[0].created_at;
    let lastSeen = events[0].created_at;
    const path: string[] = [];
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

      // Consecutive repeats collapsed: three cart_uploaded in a row is one
      // move in the story and a retry count, which `screenshots` already
      // carries. The same event again LATER is a real return and stays.
      if (path[path.length - 1] !== row.event) path.push(row.event);

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
      lastEvent: events[events.length - 1]?.event ?? null,
      path,
    });
  }

  // Newest first, the way every other list in the dashboard reads.
  return summaries.sort((a, b) => (a.lastSeen < b.lastSeen ? 1 : a.lastSeen > b.lastSeen ? -1 : 0));
}

/** One row of visitor_ips, as stored. */
export interface VisitIpRow {
  visit_id: string;
  client_ip: string;
  /** Null on rows written before 0025, and on anything that sent no header. */
  user_agent: string | null;
  created_at: string;
  submissions: { reference_number: string } | null;
}

/**
 * How long a gap can be before two visits stop looking like one person.
 *
 * Thirty minutes, the convention every web analytics tool uses for the same
 * judgement. It is a guess either way; what matters is that it is one number,
 * written down, rather than a feeling applied per report.
 */
export const VISITOR_GAP_MS = 30 * 60 * 1000;

export interface VisitorGroupInput {
  visitId: string;
  clientIp: string | null;
  userAgent: string | null;
  firstSeen: string;
  lastSeen: string;
  reference: string | null;
}

export interface VisitorGroup {
  /** Stable across a render, named for the earliest visit in the group. */
  key: string;
  /** Every visit id in the group, earliest first. One id is the common case. */
  visitIds: string[];
}

/**
 * Visits that were probably the same person, without touching what a visit is.
 *
 * Nothing here is written anywhere. visit_id stays exactly as recorded, which
 * matters more than it sounds: computeFunnel divides by counts of distinct
 * visit ids, so a merge in the data would silently rewrite every percentage
 * this dashboard has ever shown. This is a reading of the rows, taken fresh
 * each time, and deleting it changes no stored number.
 *
 * The rule is deliberately timid. Same address AND same browser AND within
 * half an hour of the group so far, or it stands alone. Two errors are
 * available and they are not equal: splitting one person into two overstates
 * how many people came, which is the error the raw table already makes and
 * everybody already reads around. Merging two people into one understates it
 * and invents a person who did more than anybody did - a claim a report should
 * never make on evidence this thin. So when in doubt this splits.
 *
 * What it cannot do: an address is not a person. Carriers here put many
 * subscribers behind one, offices and cafes share wifi, and a phone moving
 * between wifi and mobile data changes address mid-visit. So a group is a
 * suggestion to a human reading the table, never a number to plan against on
 * its own.
 */
export function groupVisitors(
  rows: VisitorGroupInput[],
  gapMs = VISITOR_GAP_MS,
): VisitorGroup[] {
  const groups: VisitorGroup[] = [];
  const buckets = new Map<string, VisitorGroupInput[]>();

  for (const row of rows) {
    // No address or no browser string is not weak evidence, it is none. A
    // visit we know nothing about stands alone rather than being folded in
    // beside whoever happens to be nearby in time.
    if (!row.clientIp || !row.userAgent) {
      groups.push({ key: `alone:${row.visitId}`, visitIds: [row.visitId] });
      continue;
    }

    // NUL between the two, so an address ending in text cannot run into a
    // browser string beginning with it and collide with a different pair.
    const key = `${row.clientIp}\u0000${row.userAgent}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(row);
    else buckets.set(key, [row]);
  }

  for (const bucket of buckets.values()) {
    const ordered = [...bucket].sort((a, b) =>
      a.firstSeen < b.firstSeen ? -1 : a.firstSeen > b.firstSeen ? 1 : 0,
    );

    let open: VisitorGroup | null = null;
    let latestEnd = 0;
    let reference: string | null = null;

    for (const row of ordered) {
      const startedAt = Date.parse(row.firstSeen);
      const endedAt = Date.parse(row.lastSeen);

      // Two visits that each sent a DIFFERENT order are two customers sitting
      // near each other, whatever the address says. An order is the one hard
      // fact available here and it outranks the rest of the evidence.
      const differentOrders =
        reference !== null && row.reference !== null && row.reference !== reference;

      const tooLate = !Number.isFinite(startedAt) || startedAt - latestEnd > gapMs;

      if (!open || differentOrders || tooLate) {
        open = { key: `together:${row.visitId}`, visitIds: [row.visitId] };
        groups.push(open);
        latestEnd = Number.isFinite(endedAt) ? endedAt : startedAt;
        reference = row.reference;
        continue;
      }

      open.visitIds.push(row.visitId);
      // Measured from where the group currently ends, so a chain of short
      // visits stays one person rather than breaking on the gap to its start.
      if (Number.isFinite(endedAt) && endedAt > latestEnd) latestEnd = endedAt;
      if (!reference) reference = row.reference;
    }
  }

  return groups;
}

/** The group each visit landed in, for a table that renders one row at a time. */
export function visitorGroupByVisit(groups: VisitorGroup[]): Map<string, VisitorGroup> {
  const index = new Map<string, VisitorGroup>();
  for (const group of groups) {
    for (const visitId of group.visitIds) index.set(visitId, group);
  }
  return index;
}

/** A visit with both its IP and what the funnel saw it do. */
export interface ValidationRow {
  visit_id: string;
  client_ip: string;
  user_agent: string | null;
  /**
   * The group this visit was read into, and how many visits are in it. Derived
   * at export time by groupVisitors and stored nowhere.
   */
  visitor_key: string;
  visits_in_group: number;
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

  // The same reading the dashboard shows, so a row exported and a row on
  // screen never disagree about who was probably who.
  const groups = groupVisitors(
    ips.map((row) => {
      const visit = byVisit.get(row.visit_id);
      return {
        visitId: row.visit_id,
        clientIp: row.client_ip,
        userAgent: row.user_agent,
        firstSeen: visit?.firstSeen ?? row.created_at,
        lastSeen: visit?.lastSeen ?? row.created_at,
        reference: row.submissions?.reference_number ?? visit?.reference ?? null,
      };
    }),
  );
  const groupOf = visitorGroupByVisit(groups);

  const rows = ips.map((row) => {
    const visit = byVisit.get(row.visit_id);
    // Either source will do. visitor_ips learns the submission on the event
    // that created it; funnel_events carries it on the same event. Taking
    // whichever has it means one missed upsert does not file a real order as
    // an abandoned visit.
    const reference = row.submissions?.reference_number ?? visit?.reference ?? null;
    const group = groupOf.get(row.visit_id);

    return {
      visit_id: row.visit_id,
      client_ip: row.client_ip,
      user_agent: row.user_agent,
      visitor_key: group?.key ?? `alone:${row.visit_id}`,
      visits_in_group: group?.visitIds.length ?? 1,
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

/**
 * How long a visit can go quiet before it stops being somebody still reading.
 *
 * Fifteen minutes, which is the window the live page already uses to decide a
 * visit is worth listing (LIVE_PRESENCE_WINDOW_MINUTES in lib/admin/queries).
 * The heartbeat fires every 20 seconds while the tab is visible, so a page
 * somebody is actually on refreshes last_seen about forty-five times inside
 * that window: anything quieter is not a person sitting there.
 *
 * Not shorter, because the heartbeat stops the moment the tab is hidden and
 * this flow is built around sending people to another app. Ten minutes would
 * file somebody still building a Talabat cart as gone. The food-app case is
 * caught by its own rule below rather than by this number, but the margin is
 * deliberate: the cost of calling a live visitor abandoned is a wrong story in
 * a report, and the cost of waiting another five minutes is nothing.
 */
export const INACTIVITY_MS = 15 * 60_000;

/**
 * What became of a visit, as far as the record can say.
 *
 * Derived, never stored. That is the property that matters: a visit called
 * abandoned at 14:05 and seen again at 14:40 is simply recomputed as active
 * the next time anybody looks, with no row to correct and no backfill to run.
 * It also means this reads correctly over visits recorded long before the
 * function existed.
 */
export type VisitOutcome =
  | "completed"
  | "active"
  | "at_food_app"
  | "abandoned"
  | "idle";

export const OUTCOME_LABELS: Record<VisitOutcome, string> = {
  completed: "Sent the order",
  active: "Still here",
  at_food_app: "Away at a food app",
  abandoned: "Left without uploading",
  idle: "Stopped",
};

/**
 * @param lastSeenAt visit_presence.last_seen_at, which the heartbeat keeps
 *   current while a tab is open. The visit's own last EVENT is not a
 *   substitute: somebody reading the screen for ten minutes records nothing,
 *   and judging them by their last event would call them gone while they are
 *   looking at it. Null falls back to the last event, which is all a visit
 *   predating the presence table has.
 */
export function visitOutcome(
  visit: VisitSummary,
  lastSeenAt: string | null,
  now: number,
  inactivityMs = INACTIVITY_MS,
): VisitOutcome {
  // An order was sent. Nothing after that changes what this visit was.
  if (visit.completed) return "completed";

  const seen = Date.parse(lastSeenAt ?? visit.lastSeen);
  const quietFor = Number.isFinite(seen) ? now - seen : Infinity;
  if (quietFor <= inactivityMs) return "active";

  // Off to fetch the screenshot we asked for, and not back yet. An intended
  // part of the flow, so it is never abandonment however long it has been -
  // the moment they return, returned_from_app becomes the last event and this
  // visit is judged on what it did afterwards instead.
  if (visit.lastEvent === "app_opened") return "at_food_app";

  // Quiet, no order, and they had started. The specific loss worth naming.
  if (visit.screenshots === 0 && visit.path.includes("wizard_started")) {
    return "abandoned";
  }

  // Quiet and no order, but they did upload something, or never opened the
  // wizard at all. Real, and not the same failure.
  return "idle";
}

/**
 * The visit as a sentence: "Need to take one → Talabat → Back → Uploaded".
 *
 * Short labels rather than the funnel's own, which are written to be read one
 * at a time in a table ("Went to a food app", "Came back from a food app") and
 * become unreadable chained five deep. Only the events that appear in a path
 * are named here, and anything unnamed falls through to the canonical label
 * rather than being dropped - a step missing from a journey is worse than a
 * long one.
 */
const PATH_LABELS: Record<string, string> = {
  landing_viewed: "Landed",
  cta_check_cart: "Tapped Check my cart",
  cta_example: "Saw the example",
  wizard_started: "Opened wizard",
  fork_have_screenshot: "Have a screenshot",
  fork_need_to_take: "Need to take one",
  app_opened: "Food app",
  landing_app_opened: "Food app",
  returned_from_app: "Returned",
  cart_uploaded: "Uploaded",
  checkout_uploaded: "Uploaded checkout",
  step_basket: "Confirm screen",
  step_where: "Chose area",
  step_review: "Gave details",
  submitted: "Sent",
  result_viewed: "Saw result",
  keeta_opened: "Tapped to Keeta",
  scroll_0: "Saw top only",
  scroll_25: "Scrolled ¼",
  scroll_50: "Scrolled ½",
  scroll_75: "Scrolled ¾",
  scroll_100: "Reached bottom",
};

export function pathLabel(event: string): string {
  return PATH_LABELS[event] ?? FUNNEL_STEP_LABELS[event] ?? event.replace(/_/g, " ");
}

/** The journey's steps, with what became of it as the final one. */
export function describeJourney(visit: VisitSummary, outcome: VisitOutcome): string[] {
  const steps = visit.path.map(pathLabel);

  // The ending, which is not an event and so is never in the path. Without it
  // a journey stops mid-sentence and two very different visits - one still
  // reading, one gone - read identically.
  const ending: Record<VisitOutcome, string | null> = {
    completed: null, // "Sent" is already the last step.
    active: "Still here",
    at_food_app: "Still away",
    abandoned: "Left",
    idle: "Stopped",
  };

  const last = ending[outcome];
  return last ? [...steps, last] : steps;
}

export interface JourneyPath {
  /** The journey, as its steps. */
  steps: string[];
  /** How many visits walked exactly this path. */
  visits: number;
  /** How many of those sent an order. */
  completed: number;
}

/**
 * Identical journeys, counted.
 *
 * The number that answers the question the exit survey was going to ask. One
 * visit's path is an anecdote; twelve visits that all read "Have a screenshot
 * → Uploaded → Left" is a screen that loses people at a nameable moment.
 */
export function topPaths(journeys: { steps: string[]; completed: boolean }[]): JourneyPath[] {
  const counts = new Map<string, JourneyPath>();

  for (const journey of journeys) {
    // The joined string is only a map key; steps are kept as an array so the
    // caller never has to split a label containing the separator back apart.
    const key = journey.steps.join("\u0000");
    const existing = counts.get(key);

    if (existing) {
      existing.visits += 1;
      if (journey.completed) existing.completed += 1;
    } else {
      counts.set(key, {
        steps: journey.steps,
        visits: 1,
        completed: journey.completed ? 1 : 0,
      });
    }
  }

  // Commonest first; a stable tiebreak so equal counts do not reorder between
  // two renders of the same data.
  return [...counts.values()].sort(
    (a, b) => b.visits - a.visits || a.steps.join(" ").localeCompare(b.steps.join(" ")),
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
