import type { Metadata } from "next";
import { Download } from "lucide-react";
import { Suspense } from "react";
import { getVisitEvents } from "@/lib/admin/queries";
import { filterByStep, isStepMatch, summarizeVisits, totalVisits } from "@/lib/calculations/visits";
import { parseDateRange } from "@/lib/admin/filters";
import { VisitFilters } from "@/components/admin/VisitFilters";
import { VisitsTable } from "@/components/admin/VisitsTable";

export const metadata: Metadata = {
  title: "Visits",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Historical per-visit table split from the Live page.
 *
 * This is a separate route so the 15-second auto-refresh on the Live page
 * never touches this data. The table fetches on demand when visited.
 *
 * One row per visit, which is the only view that can answer how many
 * screenshots one person picked, because the funnel counts distinct visits
 * per step and flattens three uploads by one person into a single tick.
 */
export default async function VisitsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const range = parseDateRange(params);
  const step = typeof params.step === "string" ? params.step : null;
  const rawMatch = typeof params.match === "string" ? params.match : null;
  const match = isStepMatch(rawMatch) ? rawMatch : "reached";

  // The same filters the table is showing, so the download is what is on
  // screen rather than whatever the route would default to on its own.
  const exportParams = new URLSearchParams();
  if (range.from) exportParams.set("from", range.from);
  if (range.to) exportParams.set("to", range.to);
  if (step) exportParams.set("step", step);
  if (match !== "reached") exportParams.set("match", match);
  const exportQuery = exportParams.toString();

  // Allowed to fail on a database that has not run 0021 yet.
  const visitEvents = await getVisitEvents(range).catch(() => []);

  const visits = filterByStep(summarizeVisits(visitEvents), step, match);
  const totals = totalVisits(visits);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-bold text-ink-900">Visits</h1>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink-700">Visit history</h2>
          {/* A plain link, not a button: the response is a file, so the browser
              should do what it does with files and nothing should re-render. */}
          <a
            href={exportQuery ? `/admin/visits-export?${exportQuery}` : "/admin/visits-export"}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 text-sm font-medium text-ink-700 hover:bg-ink-50"
          >
            <Download aria-hidden="true" className="h-3.5 w-3.5" />
            Download for Excel
          </a>
        </div>
        <Suspense fallback={<div className="h-28 rounded-2xl border border-ink-200 bg-white" />}>
          <VisitFilters />
        </Suspense>
        <VisitsTable visits={visits} totals={totals} />
      </div>
    </div>
  );
}
