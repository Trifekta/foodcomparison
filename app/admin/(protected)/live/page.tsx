import type { Metadata } from "next";
import { Suspense } from "react";
import { getLivePresence, getRecentActivity, getVisitEvents } from "@/lib/admin/queries";
import { summarizeLivePresence } from "@/lib/calculations/presence";
import { filterByStep, summarizeVisits, totalVisits } from "@/lib/calculations/visits";
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
 * The top half is "right now": who is on the site this minute, and what they
 * are touching. The bottom half is "what happened": one row per visit over a
 * window, which is the only view that can answer how many screenshots one
 * person picked - the funnel counts distinct visits per step, so it flattens
 * three uploads by one person into a single tick.
 *
 * Only the top half auto-refreshes in any meaningful sense; a date range from
 * last week does not move, and refreshing it costs nothing.
 */
export default async function LivePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const range = parseDateRange(params);
  const step = typeof params.step === "string" ? params.step : null;

  const [{ now, rows: presenceRows }, activityRows, visitEvents] = await Promise.all([
    getLivePresence(),
    getRecentActivity(),
    // Allowed to fail on a database that has not run 0021 yet: the live half
    // of this page is still worth showing when the visit table cannot be built.
    getVisitEvents(range).catch(() => []),
  ]);

  const summary = summarizeLivePresence(presenceRows, now);
  const visits = filterByStep(summarizeVisits(visitEvents), step);
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

      <div>
        <h2 className="mb-2 text-sm font-semibold text-ink-700">Recent activity</h2>
        <RecentActivityFeed rows={activityRows} now={now} />
      </div>

      <div className="space-y-3 border-t border-ink-200 pt-5">
        <h2 className="text-sm font-semibold text-ink-700">Every visit</h2>
        <Suspense fallback={<div className="h-28 rounded-2xl border border-ink-200 bg-white" />}>
          <VisitFilters />
        </Suspense>
        <VisitsTable visits={visits} totals={totals} />
      </div>
    </div>
  );
}
