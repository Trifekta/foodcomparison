import type { RecentActivityRow } from "@/lib/admin/queries";
import { FUNNEL_STEP_LABELS } from "@/lib/analytics/funnel";
import { formatRelativeTime } from "@/lib/utils/text";

/**
 * The last handful of funnel steps, as a feed rather than a count.
 *
 * The cards above answer "how many, and how far"; this answers "what just
 * happened" - which is the difference between a dashboard and a pulse. Visit
 * ids are not shown: they identify nobody, but printing one still looks like
 * an id an admin might go looking for, and there is nothing to find.
 */
export function RecentActivityFeed({ rows, now }: { rows: RecentActivityRow[]; now: number }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-ink-300 bg-white p-8 text-center">
        <p className="text-sm text-ink-500">No activity recorded yet.</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-ink-100 rounded-2xl border border-ink-200 bg-white">
      {rows.map((row) => (
        <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
          <span className="text-ink-800">
            {FUNNEL_STEP_LABELS[row.event] ?? row.event}
            {row.areas?.name ? <span className="text-ink-500"> · {row.areas.name}</span> : null}
          </span>
          <span className="shrink-0 tabular-nums text-ink-500">
            {formatRelativeTime(row.created_at, now)}
          </span>
        </li>
      ))}
    </ul>
  );
}
