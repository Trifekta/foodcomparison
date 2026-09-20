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
 * Who is on the site this minute, and the events of the last few.
 *
 * Both halves are cheap and genuinely move between ticks, which is what earns
 * the fifteen-second refresh. The per-visit table used to sit below this and
 * be re-queried on every one of those ticks - a date range that does not move,
 * rebuilt four times a minute - and now lives at /admin/live/visits, where it
 * is fetched when somebody asks for it and not before.
 *
 * It takes no search params for that reason: the filters belong to the table,
 * and leaving them here would invite a filtered URL that this page silently
 * ignores.
 */
export default async function LivePage() {
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
