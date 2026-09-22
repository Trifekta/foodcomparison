import { requireAdmin } from "@/lib/supabase/auth";
import { getVisitEvents, getVisitorIps } from "@/lib/admin/queries";
import { parseDateRange } from "@/lib/admin/filters";
import { buildValidationCsv, validationCsvFilename } from "@/lib/admin/export";
import { mergeValidationRows, summarizeVisits } from "@/lib/calculations/visits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The per-visit table with the address each visit came from.
 *
 * Two questions, one file. For a partner like Keeta it is proof the traffic is
 * real devices rather than a number in a report. Internally it is the only
 * view that can tell three people apart from one person who tapped the ad
 * three times - a visit id is one browser for one Dubai day, and an in-app
 * browser hands out a fresh one on every launch.
 *
 * Query params: from, to (YYYY-MM-DD, optional - defaults to today).
 *
 * It sits under /admin, so proxy.ts turns away anonymous requests before this
 * runs, and requireAdmin() checks again here. RLS is still the last word.
 */
export async function GET(request: Request) {
  await requireAdmin();

  const url = new URL(request.url);
  const range = parseDateRange({
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });

  const [ips, events] = await Promise.all([
    getVisitorIps(range),
    // Allowed to fail on a database that has not run 0021 yet: the IPs are
    // the point of this file, and a missing step column is worth more than
    // an error page.
    getVisitEvents(range).catch(() => []),
  ]);

  const rows = mergeValidationRows(ips, summarizeVisits(events));

  return new Response(buildValidationCsv(rows), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${validationCsvFilename(range)}"`,
      // A download is a snapshot of a moving list; a cached one is a lie.
      "Cache-Control": "no-store",
    },
  });
}
