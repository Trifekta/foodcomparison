import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { rangeToInstants, type DateRange } from "@/lib/admin/queries";
import { withAmountStrings } from "@/lib/calculations/money";

/**
 * Reading the switches back.
 *
 * Through the signed-in admin's client rather than the service role, so Row
 * Level Security is still the authority on who may see this - the same posture
 * as every other admin query here. The redirect writes with the service role
 * because the customer clicking is signed in to nothing; reading is a different
 * question and gets a different answer.
 */

export interface ClickRow {
  click_ref: string;
  submission_id: string;
  clicked_at: string;
  visit_id: string | null;
  restaurant_name: string | null;
  source_app: string | null;
  area_name: string | null;
  current_total: string | null;
  comparison_total: string | null;
  saving_amount: string | null;
  saving_percentage: number | null;
  keeta_cheaper: boolean | null;
  destination_url: string;
  conversion_status: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  submissions: { reference_number: string } | null;
}

export interface AttributionSummary {
  /** Every tap. A customer who switched twice is two. */
  totalClicks: number;
  /** Distinct visits that switched. Taps with no visit id count as one each. */
  uniqueClicks: number;
  /** Comparisons with a result worth switching from, in the same window. */
  comparisonsWithResult: number;
  /** Distinct comparisons that produced at least one switch. */
  comparisonsClicked: number;
  /** comparisonsClicked / comparisonsWithResult, 0-100. */
  clickThroughRate: number;
}

/** Statuses where an admin had saved a total, so a button existed to tap. */
const ANSWERED = ["comparison_found", "result_ready", "result_sent", "no_saving"] as const;

export async function getKeetaClicks(range: DateRange = {}, limit = 2000): Promise<ClickRow[]> {
  const supabase = await createServerSupabaseClient();
  const { since, until } = rangeToInstants(range);

  const { data, error } = await supabase
    .from("keeta_clicks")
    .select(
      "click_ref, submission_id, clicked_at, visit_id, restaurant_name, source_app, area_name, current_total, comparison_total, saving_amount, saving_percentage, keeta_cheaper, destination_url, conversion_status, utm_source, utm_medium, utm_campaign, utm_content, submissions(reference_number)",
    )
    .gte("clicked_at", since ?? "1970-01-01T00:00:00Z")
    .lte("clicked_at", until ?? "2999-12-31T23:59:59Z")
    .order("clicked_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Could not load the click-throughs: ${error.message}`);
  return ((data ?? []) as unknown as ClickRow[]).map(withAmountStrings);
}

/**
 * The denominator, and why it is this one.
 *
 * "Click-through rate" is only meaningful against the comparisons that could
 * have been clicked - the ones where an admin had saved a total and the
 * customer had something to act on. Counting it against every submission would
 * fold our own turnaround time into a number about customer behaviour, and a
 * slow week would look like a week nobody wanted to switch.
 *
 * Archived rows are excluded, exactly as the validation page excludes them: a
 * test submission counted here is a rate that is quietly wrong.
 */
export async function getAttributionSummary(range: DateRange = {}): Promise<AttributionSummary> {
  const supabase = await createServerSupabaseClient();
  const { since, until } = rangeToInstants(range);

  const [clicks, comparisons] = await Promise.all([
    supabase
      .from("keeta_clicks")
      .select("submission_id, visit_id")
      .gte("clicked_at", since ?? "1970-01-01T00:00:00Z")
      .lte("clicked_at", until ?? "2999-12-31T23:59:59Z")
      .limit(20_000),
    supabase
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .in("status", ANSWERED as unknown as string[])
      .is("archived_at", null)
      .gte("created_at", since ?? "1970-01-01T00:00:00Z")
      .lte("created_at", until ?? "2999-12-31T23:59:59Z"),
  ]);

  if (clicks.error) throw new Error(`Could not count the click-throughs: ${clicks.error.message}`);
  if (comparisons.error) {
    throw new Error(`Could not count the comparisons: ${comparisons.error.message}`);
  }

  const rows = (clicks.data ?? []) as { submission_id: string; visit_id: string | null }[];
  return summarise(rows, comparisons.count ?? 0);
}

/**
 * Counted here rather than in SQL, for the same reason the funnel is: distinct
 * counts are not something PostgREST can express, and a pilot's worth of rows
 * is nothing to hold in memory.
 *
 * Exported so it can be tested against rows rather than against a database.
 */
export function summarise(
  rows: { submission_id: string; visit_id: string | null }[],
  comparisonsWithResult: number,
): AttributionSummary {
  const visits = new Set<string>();
  const submissions = new Set<string>();
  let anonymous = 0;

  for (const row of rows) {
    submissions.add(row.submission_id);
    // A tap with no visit id is a browser with storage switched off. It is one
    // switcher we cannot deduplicate, so it counts as one rather than being
    // dropped - undercounting people who switched is the worse error.
    if (row.visit_id) visits.add(row.visit_id);
    else anonymous += 1;
  }

  return {
    totalClicks: rows.length,
    uniqueClicks: visits.size + anonymous,
    comparisonsWithResult,
    comparisonsClicked: submissions.size,
    clickThroughRate:
      comparisonsWithResult > 0
        ? Math.round((submissions.size / comparisonsWithResult) * 1000) / 10
        : 0,
  };
}
