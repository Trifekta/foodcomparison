import { requireAdmin } from "@/lib/supabase/auth";
import { listSubmissions } from "@/lib/admin/queries";
import { parseSubmissionFilters } from "@/lib/admin/filters";
import { buildSubmissionsCsv, submissionsCsvFilename } from "@/lib/admin/export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The submission list, downloaded.
 *
 * A route rather than a server action because the answer is a file: an action
 * returns data to the page, and the browser has to be handed a response with a
 * Content-Disposition on it to save anything.
 *
 * It sits under /admin, so proxy.ts turns away anonymous requests before this
 * runs, and requireAdmin() checks again here - the same two-gate arrangement
 * every admin page uses. RLS is still the last word: the query runs as the
 * signed-in user, so a session without an admin_profiles row exports an empty
 * file rather than everybody's orders.
 *
 * It reads the same query string the dashboard does, through the same parser,
 * so what downloads is what was on screen.
 */

/**
 * Higher than the table's 100.
 *
 * The table is paged for reading; an export is taken to work on elsewhere, and
 * one that silently stops at the hundredth row is worse than no export - the
 * spreadsheet looks complete. 5000 matches the analytics ceiling.
 */
const EXPORT_LIMIT = 5000;

export async function GET(request: Request) {
  await requireAdmin();

  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams.entries());
  const filters = parseSubmissionFilters(params);

  const rows = await listSubmissions(filters, EXPORT_LIMIT);
  const csv = buildSubmissionsCsv(rows);

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${submissionsCsvFilename()}"`,
      // A download is a snapshot of a moving list; a cached one is a lie.
      "Cache-Control": "no-store",
    },
  });
}
