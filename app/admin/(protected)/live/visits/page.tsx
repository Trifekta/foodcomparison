import type { Metadata } from "next";
import { Download, Fingerprint } from "lucide-react";
import { Suspense } from "react";
import { getAdLabelIndex, getVisitEvents, getVisitorIps } from "@/lib/admin/queries";
import {
  filterByStep,
  groupVisitors,
  isStepMatch,
  summarizeVisits,
  totalVisits,
} from "@/lib/calculations/visits";
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

  // Date range only. The IP export answers "how many people was that", which
  // a step filter would quietly corrupt: hiding the visits that stopped
  // earlier hides exactly the repeats it is there to find.
  const rangeParams = new URLSearchParams();
  if (range.from) rangeParams.set("from", range.from);
  if (range.to) rangeParams.set("to", range.to);
  const rangeQuery = rangeParams.toString();

  // Allowed to fail on a database that has not run 0021 yet. The IP rows are
  // allowed to fail on one that has not run 0025: without them every visit
  // simply stands alone, which is what the table said before grouping existed.
  const [visitEvents, ips, adLabels] = await Promise.all([
    getVisitEvents(range).catch(() => []),
    getVisitorIps(range).catch(() => []),
    getAdLabelIndex(),
  ]);

  const visits = filterByStep(summarizeVisits(visitEvents), step, match);
  const totals = totalVisits(visits);

  // Grouped over the filtered list, so the count on screen always describes
  // the rows on screen. A step filter therefore narrows both numbers together.
  const ipByVisit = new Map(ips.map((row) => [row.visit_id, row]));
  const groups = groupVisitors(
    visits.map((visit) => ({
      visitId: visit.visitId,
      clientIp: ipByVisit.get(visit.visitId)?.client_ip ?? null,
      userAgent: ipByVisit.get(visit.visitId)?.user_agent ?? null,
      firstSeen: visit.firstSeen,
      lastSeen: visit.lastSeen,
      reference: visit.reference,
    })),
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-bold text-ink-900">Visits</h1>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink-700">Visit history</h2>
          {/* Plain links, not buttons: the response is a file, so the browser
              should do what it does with files and nothing should re-render. */}
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={exportQuery ? `/admin/visits-export?${exportQuery}` : "/admin/visits-export"}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 text-sm font-medium text-ink-700 hover:bg-ink-50"
            >
              <Download aria-hidden="true" className="h-3.5 w-3.5" />
              Download for Excel
            </a>
            {/* The same rows plus the address each visit came from, and how
                many visits shared it. Separate from the download above because
                it carries IPs: the table on screen is deliberately anonymous,
                and this is the one place that is not. Only the date range
                carries over - the step filter does not, because a file meant
                for spotting one person across several visits must not be
                missing the visits that stopped somewhere else. */}
            <a
              href={
                rangeQuery
                  ? `/admin/api/validation-export?${rangeQuery}`
                  : "/admin/api/validation-export"
              }
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 text-sm font-medium text-ink-700 hover:bg-ink-50"
            >
              <Fingerprint aria-hidden="true" className="h-3.5 w-3.5" />
              With IPs
            </a>
          </div>
        </div>
        <Suspense fallback={<div className="h-28 rounded-2xl border border-ink-200 bg-white" />}>
          <VisitFilters />
        </Suspense>
        <VisitsTable visits={visits} totals={totals} labels={adLabels} groups={groups} />
      </div>
    </div>
  );
}
