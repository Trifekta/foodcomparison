import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SIGNED_URL_TTL_SECONDS, STORAGE_BUCKET } from "@/lib/constants";
import type { AnalyticsRow } from "@/lib/calculations/analytics";
import type { FunnelAreaRow, FunnelRow } from "@/lib/analytics/funnel";
import { withAmountStrings } from "@/lib/calculations/money";
import type {
  AreaRow,
  SubmissionEventRow,
  SubmissionExtractionRow,
  SubmissionItemRow,
  SubmissionStatus,
  SubmissionWithArea,
} from "@/types/database";

/**
 * Admin reads.
 *
 * Everything here uses the session-scoped client, so Row Level Security decides
 * what comes back. A signed-in user without an admin_profiles row sees nothing,
 * regardless of what the UI does.
 */

export interface SubmissionFilters {
  /**
   * Which side of the archive to show. Defaults to the working list, because
   * that is what the dashboard is for: archiving something and still finding it
   * in front of you would make the button pointless.
   */
  archived?: "active" | "archived" | "all";
  status?: SubmissionStatus | "all";
  areaId?: string;
  sourceApp?: string;
  from?: string;
  to?: string;
  search?: string;
}

const LIST_COLUMNS =
  "id, reference_number, created_at, status, source_app, source_app_other, current_total, comparison_total, saving_amount, saving_percentage, contact_type, area_id, archived_at, new_to_keeta, areas(id, name)";

export interface SubmissionListRow {
  id: string;
  reference_number: string;
  created_at: string;
  status: SubmissionStatus;
  source_app: string;
  source_app_other: string | null;
  current_total: string;
  comparison_total: string | null;
  saving_amount: string | null;
  saving_percentage: string | null;
  contact_type: "whatsapp" | "email";
  area_id: string | null;
  archived_at: string | null;
  /** Said yes on step 3 - worth pricing with Keeta's new-customer discount in mind. */
  new_to_keeta: boolean;
  areas: { id: string; name: string } | null;
}

export async function listSubmissions(
  filters: SubmissionFilters,
  limit = 100,
): Promise<SubmissionListRow[]> {
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("submissions")
    .select(LIST_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);

  const archived = filters.archived ?? "active";
  if (archived === "active") query = query.is("archived_at", null);
  if (archived === "archived") query = query.not("archived_at", "is", null);

  if (filters.status && filters.status !== "all") query = query.eq("status", filters.status);
  if (filters.areaId) query = query.eq("area_id", filters.areaId);
  if (filters.sourceApp) query = query.eq("source_app", filters.sourceApp);
  if (filters.from) query = query.gte("created_at", `${filters.from}T00:00:00Z`);
  if (filters.to) query = query.lte("created_at", `${filters.to}T23:59:59Z`);

  if (filters.search) {
    // Escape PostgREST's or() separators before interpolating the term.
    const term = filters.search.replace(/[(),*]/g, " ").trim();
    if (term) {
      query = query.or(
        `reference_number.ilike.%${term}%,whatsapp_number.ilike.%${term}%,email.ilike.%${term}%`,
      );
    }
  }

  const { data, error } = await query;
  if (error) throw new Error(`Could not load submissions: ${error.message}`);
  return ((data ?? []) as unknown as SubmissionListRow[]).map(withAmountStrings);
}

export interface DashboardCounts {
  newCount: number;
  reviewingCount: number;
  readyCount: number;
  sentToday: number;
}

export async function getDashboardCounts(): Promise<DashboardCounts> {
  const supabase = await createServerSupabaseClient();

  // Midnight in Dubai (UTC+4), expressed in UTC.
  const now = new Date();
  const dubaiNow = new Date(now.getTime() + 4 * 60 * 60 * 1000);
  const startOfDubaiDay = new Date(
    Date.UTC(dubaiNow.getUTCFullYear(), dubaiNow.getUTCMonth(), dubaiNow.getUTCDate()) -
      4 * 60 * 60 * 1000,
  );

  // Every count here is of the working list. An archived row is one somebody
  // has already dealt with, and leaving it in "NEW: 2" would mean the number
  // that is meant to say "go and do something" never reaches zero.
  const countFor = (status: SubmissionStatus) =>
    supabase
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .is("archived_at", null)
      .eq("status", status);

  const [newRes, reviewingRes, readyRes, sentRes] = await Promise.all([
    countFor("new"),
    countFor("reviewing"),
    supabase
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .is("archived_at", null)
      .in("status", ["result_ready", "no_saving"]),
    supabase
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .is("archived_at", null)
      .eq("status", "result_sent")
      .gte("result_sent_at", startOfDubaiDay.toISOString()),
  ]);

  return {
    newCount: newRes.count ?? 0,
    reviewingCount: reviewingRes.count ?? 0,
    readyCount: readyRes.count ?? 0,
    sentToday: sentRes.count ?? 0,
  };
}

export async function getSubmission(id: string): Promise<SubmissionWithArea | null> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("submissions")
    .select("*, areas(id, name, test_location_label, admin_location_notes)")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Could not load submission: ${error.message}`);
  if (!data) return null;
  return withAmountStrings(data as unknown as SubmissionWithArea);
}

/** The optional item list the customer confirmed. Often empty. */
export async function getSubmissionItems(id: string): Promise<SubmissionItemRow[]> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("submission_items")
    .select("*")
    .eq("submission_id", id)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(`Could not load items: ${error.message}`);
  return (data ?? []) as SubmissionItemRow[];
}

/**
 * The most recent extraction run, so reloading the page does not lose a result
 * the admin has not confirmed yet.
 */
export async function getLatestExtraction(id: string): Promise<SubmissionExtractionRow | null> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("submission_extractions")
    .select("*")
    .eq("submission_id", id)
    .eq("status", "ok")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return null;
  return (data as SubmissionExtractionRow | null) ?? null;
}

export async function getSubmissionEvents(id: string): Promise<SubmissionEventRow[]> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("submission_events")
    .select("*")
    .eq("submission_id", id)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) throw new Error(`Could not load history: ${error.message}`);
  return (data ?? []) as SubmissionEventRow[];
}

export async function listAreas(includeInactive = true): Promise<AreaRow[]> {
  const supabase = await createServerSupabaseClient();

  let query = supabase.from("areas").select("*").order("sort_order").order("name");
  if (!includeInactive) query = query.eq("active", true);

  const { data, error } = await query;
  if (error) throw new Error(`Could not load areas: ${error.message}`);
  return (data ?? []) as AreaRow[];
}

/**
 * Short-lived signed URL for a private screenshot. Returns null when the object
 * is missing (for example on seeded development rows) so the UI can show an
 * honest empty state instead of a broken image.
 */
export async function getSignedImageUrl(path: string | null): Promise<string | null> {
  if (!path) return null;

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  if (error || !data) return null;
  return data.signedUrl;
}

/**
 * Rows behind the validation metrics.
 *
 * Aggregated in the application rather than in SQL: at MVP volumes this is a
 * single small query, and keeping the maths in TypeScript means the same
 * functions are unit-tested. Move it into a database view if volume grows.
 */
export interface DateRange {
  /** Inclusive, as YYYY-MM-DD. Undefined means "no bound on this side". */
  from?: string;
  to?: string;
}

/**
 * Turns a YYYY-MM-DD range into the instants either side of it, in Dubai time.
 *
 * A report for "1 September" has to mean the day the person asking lived
 * through, not the UTC day - a submission at 1am Dubai on the 2nd is 9pm UTC on
 * the 1st, and putting it in the wrong day makes a daily report disagree with
 * the dashboard it was downloaded from.
 */
export function rangeToInstants(range: DateRange): { since?: string; until?: string } {
  return {
    since: range.from ? `${range.from}T00:00:00+04:00` : undefined,
    until: range.to ? `${range.to}T23:59:59+04:00` : undefined,
  };
}

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "D Mon YYYY" straight from the digits, so a display label can never land on
 * the wrong side of a timezone the way parsing "YYYY-MM-DD" with `Date` can. */
function formatIsoDateLabel(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return `${day} ${MONTH_LABELS[month - 1]} ${year}`;
}

/**
 * What to call a range on screen.
 *
 * getFunnelRows defaults to the last 30 days when no range is given, so that
 * is the only case this says "Last 30 days" - the moment somebody picks a
 * preset or a custom range, the label has to say what it actually is, or the
 * screen keeps claiming a window it is no longer showing.
 */
export function describeDateRange(range: DateRange): string {
  if (!range.from && !range.to) return "Last 30 days";
  if (range.from && range.to) {
    return range.from === range.to
      ? formatIsoDateLabel(range.from)
      : `${formatIsoDateLabel(range.from)} – ${formatIsoDateLabel(range.to)}`;
  }
  return range.from ? `Since ${formatIsoDateLabel(range.from)}` : `Until ${formatIsoDateLabel(range.to!)}`;
}

export async function getAnalyticsRows(
  limit = 5000,
  range: DateRange = {},
): Promise<AnalyticsRow[]> {
  const supabase = await createServerSupabaseClient();
  const { since, until } = rangeToInstants(range);

  // Archived rows are excluded on purpose. These are the numbers that decide
  // whether the business works, and a test submission or a duplicate counted
  // among them is worse than no number at all - archiving is how somebody says
  // "this one was not real", so honouring it here is the point of the feature.
  const { data, error } = await supabase
    .from("submissions")
    .select(
      "status, source_app, current_total, comparison_total, saving_amount, restaurant_name, unavailable_reason, areas(name)",
    )
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(limit)
    .gte("created_at", since ?? "1970-01-01T00:00:00Z")
    .lte("created_at", until ?? "2999-12-31T23:59:59Z");

  if (error) throw new Error(`Could not load analytics: ${error.message}`);
  return ((data ?? []) as unknown as AnalyticsRow[]).map(withAmountStrings);
}

/**
 * The funnel rows, for the dashboard to count.
 *
 * Counted in JS rather than in SQL because the honest measure is distinct
 * visits per step, PostgREST has no way to express that, and a pilot's worth of
 * rows is nothing. The window keeps it that way: a funnel is a question about
 * now, and a run from three months ago answers nothing about this week's ad.
 */
export async function getFunnelRows(
  days = 30,
  limit = 20000,
  range: DateRange = {},
): Promise<(FunnelRow & FunnelAreaRow)[]> {
  const supabase = await createServerSupabaseClient();
  // An explicit range wins; the rolling window is only the default view.
  const bounds = rangeToInstants(range);
  const since =
    bounds.since ?? new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("funnel_events")
    .select("event, visit_id, areas(name)")
    .gte("created_at", since)
    .lte("created_at", bounds.until ?? "2999-12-31T23:59:59Z")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Could not load the funnel: ${error.message}`);
  return (data ?? []) as unknown as (FunnelRow & FunnelAreaRow)[];
}

/**
 * How far back the live page reads visit_presence.
 *
 * Wider than the 2-minute window that decides "active now"
 * (lib/calculations/presence.ts): the extra minutes are what let the table
 * show somebody trailing off - "seen 6 minutes ago" - rather than the row
 * vanishing the instant they cross the active threshold.
 */
const LIVE_PRESENCE_WINDOW_MINUTES = 15;

export interface LivePresenceRow {
  visit_id: string;
  last_seen_at: string;
  last_event: string | null;
  submission_id: string | null;
  area_id: string | null;
  areas: { name: string } | null;
  submissions: { reference_number: string } | null;
}

export interface LivePresenceResult {
  /**
   * The instant this query ran, handed back rather than left for the page to
   * find on its own - a React Server Component reading Date.now() itself
   * reads as an impure render to the compiler's rules, and this is the one
   * legitimate place for that clock read to live.
   */
  now: number;
  rows: LivePresenceRow[];
}

export async function getLivePresence(
  windowMinutes = LIVE_PRESENCE_WINDOW_MINUTES,
): Promise<LivePresenceResult> {
  const supabase = await createServerSupabaseClient();
  const now = Date.now();
  const since = new Date(now - windowMinutes * 60_000).toISOString();

  const { data, error } = await supabase
    .from("visit_presence")
    .select(
      "visit_id, last_seen_at, last_event, submission_id, area_id, areas(name), submissions(reference_number)",
    )
    .gte("last_seen_at", since)
    .order("last_seen_at", { ascending: false });

  if (error) throw new Error(`Could not load live visits: ${error.message}`);
  return { now, rows: (data ?? []) as unknown as LivePresenceRow[] };
}

export interface RecentActivityRow {
  id: number;
  created_at: string;
  event: string;
  visit_id: string;
  areas: { name: string } | null;
}

/** The last handful of funnel steps, newest first - a feed, not a count. */
export async function getRecentActivity(limit = 25): Promise<RecentActivityRow[]> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("funnel_events")
    .select("id, created_at, event, visit_id, areas(name)")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Could not load recent activity: ${error.message}`);
  return (data ?? []) as unknown as RecentActivityRow[];
}
