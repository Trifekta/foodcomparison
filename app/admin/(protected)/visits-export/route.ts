import { requireAdmin } from "@/lib/supabase/auth";
import { getVisitEvents, VISIT_EVENTS_LIMIT } from "@/lib/admin/queries";
import { parseDateRange } from "@/lib/admin/filters";
import { buildVisitsCsv, visitsCsvFilename } from "@/lib/admin/export";
import { filterByStep, isStepMatch, summarizeVisits } from "@/lib/calculations/visits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The per-visit table, downloaded.
 *
 * A route rather than a server action because the answer is a file: an action
 * returns data to the page, and the browser has to be handed a response with a
 * Content-Disposition on it to save anything.
 *
 * It reads the same query string the Live page does, through the same parsers
 * and the same two pure functions, so what downloads is exactly what was on
 * screen - including the 200-row cap the table applies for display, which is
 * deliberately NOT applied here. The cap exists so a page re-rendered every
 * fifteen seconds cannot build unbounded HTML; a download is taken once, to
 * work on elsewhere, and one that silently stopped at the two-hundredth row
 * would look complete and be wrong.
 *
 * It sits under /admin, so proxy.ts turns away anonymous requests before this
 * runs, and requireAdmin() checks again here. RLS is still the last word.
 */
export async function GET(request: Request) {
  await requireAdmin();

  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams.entries());

  const range = parseDateRange(params);
  const step = typeof params.step === "string" ? params.step : null;
  const rawMatch = typeof params.match === "string" ? params.match : null;
  const match = isStepMatch(rawMatch) ? rawMatch : "reached";

  const events = await getVisitEvents(range, VISIT_EVENTS_LIMIT);
  const visits = filterByStep(summarizeVisits(events), step, match);

  return new Response(buildVisitsCsv(visits), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${visitsCsvFilename(range, step)}"`,
      // A download is a snapshot of a moving list; a cached one is a lie.
      "Cache-Control": "no-store",
    },
  });
}
