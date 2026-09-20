import type { Metadata } from "next";
import { Download } from "lucide-react";
import { Suspense } from "react";
import { getLivePresence, getRecentActivity, getVisitEvents } from "@/lib/admin/queries";
import { summarizeLivePresence } from "@/lib/calculations/presence";
import { filterByStep, isStepMatch, summarizeVisits, totalVisits } from "@/lib/calculations/visits";
import { parseDateRange } from "@/lib/admin/filters";
import { LiveNow } from "@/components/admin/LiveNow";
import { LiveVisitsTable } from "@/components/admin/LiveVisitsTable";
import { RecentActivityFeed } from "@/components/admin/RecentActivityFeed";
import { LiveAutoRefresh } from "@/components/admin/LiveAutoRefresh";
import { VisitFilters } from "@/components/admin/VisitFilters";
import { VisitsTable } from "@/components/admin/VisitsTable";

export const metadata: Metadata = {
  title: "Live",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Two questions on one page, deliberately in this order.
 *
 * Who is on the site this minute, then one row per visit over a window, then
 * the raw event feed. The per-visit table is the reason this page gets opened
 * - it is the only view that can answer how many screenshots one person
 * picked, because the funnel counts distinct visits per step and so flattens
 * three uploads by one person into a single tick - so it sits above the feed
 * rather than below twenty-five rows of it, where nobody scrolled to find it.
 *
 * Only the live sections auto-refresh in any meaningful sense; a date range
 * from last week does not move, and refreshing it costs nothing.
 */
export default async function LivePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const range = parseDateRange(params);
  const step = typeof params.step === "string" ? params.step : null;
  // "reached" is the funnel question, "stopped" is the where-they-died one.
  // Anything unrecognised falls back to reached rather than emptying the table.
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

  const [{ now, rows: presenceRows }, activityRows, visitEvents] = await Promise.all([
    getLivePresence(),
    // Ten, not twenty-five: this is the "what is happening right now" feed,
    // and a long one pushed the per-visit table below the fold on a laptop.
    getRecentActivity(10),
    // Allowed to fail on a database that has not run 0021 yet: the live half
    // of this page is still worth showing when the visit table cannot be built.
    getVisitEvents(range).catch(() => []),
  ]);

  const summary = summarizeLivePresence(presenceRows, now);
  const visits = filterByStep(summarizeVisits(visitEvents), step, match);
  const totals = totalVisits(visits);

  return (
    <div className="space-y-5">
      <LiveAutoRefresh />

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-bold text-ink-900">Live</h1>
        <p className="text-sm text-ink-500">Refreshes on its own every 15 seconds</p>
      </div>

      <LiveNow summary={summary} />

      <div>
        <h2 className="mb-2 text-sm font-semibold text-ink-700">On the site now</h2>
        <LiveVisitsTable rows={presenceRows} now={now} />
      </div>

      <div className="space-y-3 border-t border-ink-200 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink-700">Every visit</h2>
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

      <div className="border-t border-ink-200 pt-5">
        <h2 className="mb-2 text-sm font-semibold text-ink-700">Recent activity</h2>
        <RecentActivityFeed rows={activityRows} now={now} />
      </div>
    </div>
  );
}
