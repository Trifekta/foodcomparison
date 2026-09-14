import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidRedirectToken } from "@/lib/utils/reference";
import { checkKeetaDestination, describeRefusal } from "@/lib/keeta/destination";
import { cleanVisitId, recordKeetaClick } from "@/lib/keeta/clicks";
import { calculateSavingFromStrings } from "@/lib/calculations/saving";
import { formatMinorToDecimalString, withAmountStrings } from "@/lib/calculations/money";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The switch, made first-party.
 *
 * "Open on Keeta" used to be an ordinary link: the customer left and nothing
 * was written down. This is the same tap with a step in the middle - look up
 * the comparison, check the destination, write the click, forward - so that
 * "somebody saw this saving and then switched" is a row in our database rather
 * than an inference from a funnel counter.
 *
 * Three rules shape everything here:
 *
 *  1. The customer's redirect is never the casualty. A failed write, a slow
 *     database, a missing column - none of them may strand somebody on an error
 *     page between our site and the restaurant they were going to. The only
 *     thing that stops a redirect is a destination we will not vouch for.
 *  2. The destination is checked here, not only when it was saved. A row
 *     already in the database is exactly what a later check exists to catch.
 *  3. Every tap is a row. A double tap is two clicks and one visit, which is
 *     two numbers worth having, so nothing is deduplicated on the way in.
 */

/** Long enough for an ordinary write, short enough that nobody feels it. */
const WRITE_BUDGET_MS = 1_500;

interface ComparisonRow {
  id: string;
  restaurant_name: string | null;
  source_app: string | null;
  source_app_other: string | null;
  area_id: string | null;
  current_total: string | null;
  comparison_total: string | null;
  saving_percentage: string | null;
  comparison_url: string | null;
  areas: { name: string } | null;
}

/** Where somebody lands when there is nothing safe to send them to. */
function fallback(request: Request, reason: string) {
  const url = new URL("/go/unavailable", request.url);
  url.searchParams.set("why", reason);
  return NextResponse.redirect(url, {
    status: 302,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  // Shape-checked before the query, so a malformed token is never a round trip
  // and never reaches Postgres as a value it has to have an opinion about.
  if (!isValidRedirectToken(token)) {
    return fallback(request, "unknown");
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("submissions")
    .select(
      "id, restaurant_name, source_app, source_app_other, area_id, current_total, comparison_total, saving_percentage, comparison_url, areas(name)",
    )
    .eq("redirect_token", token)
    .maybeSingle();

  if (error) {
    console.error("[go] could not read the comparison", { message: error.message });
    return fallback(request, "error");
  }

  // A token nobody recognises and a comparison that has been deleted are the
  // same answer, deliberately: nothing here tells a prober which tokens exist.
  if (!data) return fallback(request, "unknown");

  const row = withAmountStrings(data) as unknown as ComparisonRow;

  // ---- the destination, checked at the moment of use ----------------------
  const destination = checkKeetaDestination(row.comparison_url);
  if (!destination.ok) {
    // Logged with the submission id rather than the link, so the admin can find
    // the row and fix the paste. The reason is the useful half.
    console.error("[go] refused to redirect", {
      submissionId: row.id,
      reason: destination.reason,
      detail: describeRefusal(destination.reason),
    });
    return fallback(request, destination.reason === "missing" ? "nolink" : "blocked");
  }

  // ---- what the customer was looking at -----------------------------------
  // Recomputed exactly as the result page computes it, so the row records the
  // saving that was on the screen rather than a second opinion about it.
  const saving =
    row.comparison_total !== null && row.current_total !== null
      ? calculateSavingFromStrings(row.current_total, row.comparison_total)
      : null;

  const url = new URL(request.url);

  const write = recordKeetaClick({
    submissionId: row.id,
    destinationUrl: destination.url,
    // Sent by the button from sessionStorage. It is the funnel's own visit id,
    // which is what separates unique switchers from total taps.
    visitId: cleanVisitId(url.searchParams.get("v")),
    restaurantName: row.restaurant_name,
    sourceApp: row.source_app_other || row.source_app,
    areaId: row.area_id,
    areaName: row.areas?.name ?? null,
    currentTotal: row.current_total,
    comparisonTotal: row.comparison_total,
    savingAmount:
      saving && saving.hasSaving ? formatMinorToDecimalString(saving.savingMinor) : null,
    savingPercentage:
      saving && saving.hasSaving ? Math.round(saving.savingPercentage) : null,
    keetaCheaper: saving ? saving.hasSaving : null,
    userAgent: request.headers.get("user-agent"),
    referrer: request.headers.get("referer"),
    // Carried on the link when a campaign put them there. Nothing populates
    // these today - see the note in the README - and the columns are read
    // rather than invented so that the day something does, this is already done.
    utmSource: url.searchParams.get("utm_source"),
    utmMedium: url.searchParams.get("utm_medium"),
    utmCampaign: url.searchParams.get("utm_campaign"),
    campaignId: url.searchParams.get("campaign_id") ?? url.searchParams.get("gclid"),
  });

  // Raced rather than simply awaited. An ordinary insert wins this comfortably;
  // a database having a bad minute must not hold a customer on a blank tab, and
  // the write is left running either way.
  const recorded = await Promise.race([
    write,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), WRITE_BUDGET_MS)),
  ]);

  if (recorded === null) {
    console.warn("[go] redirecting before the click was confirmed", { submissionId: row.id });
  } else if (!recorded.ok) {
    // The customer still goes to Keeta. A click we failed to record is a number
    // missing from a report; refusing the redirect over it would be the product
    // not working.
    console.error("[go] could not record the click", {
      submissionId: row.id,
      clickRef: recorded.clickRef,
      message: recorded.error,
    });
  }

  // 302 and no-store, both deliberate. A 301 is cached by the browser, which
  // would mean the second tap never reaches us and every customer counts once
  // however many times they switched.
  return NextResponse.redirect(destination.url, {
    status: 302,
    headers: { "Cache-Control": "no-store" },
  });
}
