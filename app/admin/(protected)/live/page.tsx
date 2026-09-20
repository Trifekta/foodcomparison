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

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Real-time view of who is on the site right now, plus recent events.
 *
 * This auto-refreshes every 15 seconds. The historical per-visit table
 * was split onto its own route (/admin/live/visits) so this refresh never
 * touches historical data.
 */
export default async function LivePage({ searchParams }: { searchParams: SearchParams }) {
  const [{ now, rows: presenceRows }, activityRows] = await Promise.all([
    getLivePresence(),
    // Ten, not twenty-five: this is the "what is happening right now" feed.
    getRecentActivity(10),
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
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink-700">On the site now</h2>
          <a
            href="/admin/live/visits"
            className="text-sm text-ink-600 underline underline-offset-2 hover:text-ink-900"
          >
            View visit history
          </a>
        </div>
        <LiveVisitsTable rows={presenceRows} now={now} />
      </div>

      <div className="border-t border-ink-200 pt-5">
        <h2 className="mb-2 text-sm font-semibold text-ink-700">Recent activity</h2>
        <RecentActivityFeed rows={activityRows} now={now} />
      </div>
    </div>
  );
}
