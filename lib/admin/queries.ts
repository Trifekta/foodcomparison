import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SIGNED_URL_TTL_SECONDS, STORAGE_BUCKET } from "@/lib/constants";
import type { AnalyticsRow } from "@/lib/calculations/analytics";
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
  status?: SubmissionStatus | "all";
  areaId?: string;
  sourceApp?: string;
  from?: string;
  to?: string;
  search?: string;
}

const LIST_COLUMNS =
  "id, reference_number, created_at, status, source_app, source_app_other, current_total, comparison_total, saving_amount, saving_percentage, contact_type, area_id, areas(id, name)";

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

  const countFor = (status: SubmissionStatus) =>
    supabase.from("submissions").select("id", { count: "exact", head: true }).eq("status", status);

  const [newRes, reviewingRes, readyRes, sentRes] = await Promise.all([
    countFor("new"),
    countFor("reviewing"),
    supabase
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .in("status", ["result_ready", "no_saving"]),
    supabase
      .from("submissions")
      .select("id", { count: "exact", head: true })
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
export async function getAnalyticsRows(limit = 5000): Promise<AnalyticsRow[]> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("submissions")
    .select(
      "status, source_app, current_total, comparison_total, saving_amount, restaurant_name, unavailable_reason, areas(name)",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Could not load analytics: ${error.message}`);
  return ((data ?? []) as unknown as AnalyticsRow[]).map(withAmountStrings);
}
