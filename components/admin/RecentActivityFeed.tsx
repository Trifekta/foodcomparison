import type { RecentActivityRow } from "@/lib/admin/queries";
import { FUNNEL_STEP_LABELS } from "@/lib/analytics/funnel";
import { formatRelativeTime } from "@/lib/utils/text";

/**
 * The last handful of funnel steps, as a table rather than a count.
 *
 * The cards above answer "how many, and how far"; this answers "what just
 * happened" - which is the difference between a dashboard and a pulse. Same
 * column shape as the recent-visits table above it, so the two read as one
 * page rather than two different ones stacked together. Visit ids are not
 * shown: they identify nobody, but printing one still looks like an id an
 * admin might go looking for, and there is nothing to find.
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
    <div className="overflow-hidden rounded-2xl border border-ink-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-ink-100 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
            <th className="px-4 py-2.5">Time</th>
            <th className="px-4 py-2.5">Step</th>
            <th className="px-4 py-2.5">Area</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="px-4 py-2.5 tabular-nums text-ink-500">
                {formatRelativeTime(row.created_at, now)}
              </td>
              <td className="px-4 py-2.5 text-ink-800">
                {FUNNEL_STEP_LABELS[row.event] ?? row.event}
              </td>
              <td className="px-4 py-2.5 text-ink-600">{row.areas?.name ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
