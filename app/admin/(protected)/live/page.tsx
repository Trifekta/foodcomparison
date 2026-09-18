import type { Metadata } from "next";
import { getLivePresence, getRecentActivity } from "@/lib/admin/queries";
import { summarizeLivePresence } from "@/lib/calculations/presence";
import { LiveNow } from "@/components/admin/LiveNow";
import { LiveVisitsTable } from "@/components/admin/LiveVisitsTable";
import { RecentActivityFeed } from "@/components/admin/RecentActivityFeed";
import { LiveAutoRefresh } from "@/components/admin/LiveAutoRefresh";

export const metadata: Metadata = {
  title: "Live",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Who is on the site right now, and what they are doing.
 *
 * Built on the funnel's own tracking rather than anything new: visit_presence
 * is a heartbeat away from the same visit id the funnel already counts, so
 * "active now" and "reached step three today" are the same kind of number,
 * just read over a different window. See lib/calculations/presence.ts for the
 * two-minute rule that decides "active".
 */
export default async function LivePage() {
  const [{ now, rows: presenceRows }, activityRows] = await Promise.all([
    getLivePresence(),
    getRecentActivity(),
  ]);

  const summary = summarizeLivePresence(presenceRows, now);

  return (
    <div className="space-y-5">
      <LiveAutoRefresh />

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-bold text-ink-900">Live</h1>
        <p className="text-sm text-ink-500">Refreshes on its own every 15 seconds</p>
      </div>

      <LiveNow summary={summary} />

      <div>
        <h2 className="mb-2 text-sm font-semibold text-ink-700">Recent visits</h2>
        <LiveVisitsTable rows={presenceRows} now={now} />
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-ink-700">Recent activity</h2>
        <RecentActivityFeed rows={activityRows} now={now} />
      </div>
    </div>
  );
}
