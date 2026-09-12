import { requireAdmin } from "@/lib/supabase/auth";
import { getAnalyticsRows, getFunnelRows, type DateRange } from "@/lib/admin/queries";
import { computeValidationMetrics } from "@/lib/calculations/analytics";
import { computeAreaFunnel, computeFunnel } from "@/lib/analytics/funnel";
import { buildReportCsv, reportCsvFilename } from "@/lib/admin/export";
import { parseDateRange } from "@/lib/admin/filters";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The Validation page, downloaded, for whatever range was asked for.
 *
 * Separate from /admin/export, which is the submission list. This is the
 * summary - the numbers somebody puts in front of an investor or a delivery
 * platform - and it is a different shape: one row per metric, not one row per
 * order.
 *
 * Guarded twice like every admin route, and the queries run as the signed-in
 * user, so RLS decides what it can actually see.
 */

export async function GET(request: Request) {
  await requireAdmin();

  const url = new URL(request.url);
  const range: DateRange = parseDateRange(Object.fromEntries(url.searchParams.entries()));

  // The funnel tolerates a database that has not run 0009, exactly as the page
  // does: a missing table should cost the funnel section, not the whole report.
  const [rows, funnelRows] = await Promise.all([
    getAnalyticsRows(5000, range),
    getFunnelRows(30, 20000, range).catch(() => []),
  ]);

  const csv = buildReportCsv(
    computeValidationMetrics(rows),
    computeFunnel(funnelRows),
    range,
    computeAreaFunnel(funnelRows),
  );

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${reportCsvFilename(range)}"`,
      "Cache-Control": "no-store",
    },
  });
}
