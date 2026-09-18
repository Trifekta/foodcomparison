import Link from "next/link";
import type { LivePresenceRow } from "@/lib/admin/queries";
import { FUNNEL_STEP_LABELS } from "@/lib/analytics/funnel";
import { ACTIVE_WINDOW_MS } from "@/lib/calculations/presence";
import { formatRelativeTime } from "@/lib/utils/text";

function stepLabel(row: LivePresenceRow): string {
  return row.last_event ? (FUNNEL_STEP_LABELS[row.last_event] ?? row.last_event) : "Just arrived";
}

/** A live dot for anyone still inside the active window; a stale one past it. */
function PresenceDot({ isActive }: { isActive: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${
        isActive ? "bg-emerald-500" : "bg-ink-300"
      }`}
    />
  );
}

/**
 * Every visit seen recently, newest first.
 *
 * Wider than "active now" on purpose (see lib/admin/queries.ts) - a visit
 * fading from green to grey as it crosses the two-minute line reads better
 * than one that is there and then simply gone.
 */
export function LiveVisitsTable({ rows, now }: { rows: LivePresenceRow[]; now: number }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-ink-300 bg-white p-8 text-center">
        <p className="text-sm text-ink-500">Nobody has been on the site in the last 15 minutes.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-ink-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-ink-100 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
            <th className="px-4 py-2.5">Seen</th>
            <th className="px-4 py-2.5">Step</th>
            <th className="px-4 py-2.5">Area</th>
            <th className="px-4 py-2.5">Order</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {rows.map((row) => {
            const isActive = now - Date.parse(row.last_seen_at) < ACTIVE_WINDOW_MS;
            return (
              <tr key={row.visit_id}>
                <td className="px-4 py-2.5">
                  <span className="inline-flex items-center gap-2 tabular-nums text-ink-800">
                    <PresenceDot isActive={isActive} />
                    {formatRelativeTime(row.last_seen_at, now)}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-ink-800">{stepLabel(row)}</td>
                <td className="px-4 py-2.5 text-ink-600">{row.areas?.name ?? "—"}</td>
                <td className="px-4 py-2.5">
                  {row.submissions?.reference_number ? (
                    <Link
                      href={`/admin/submissions/${row.submission_id}`}
                      className="font-medium text-brand-700 hover:text-brand-900 hover:underline"
                    >
                      {row.submissions.reference_number}
                    </Link>
                  ) : (
                    <span className="text-ink-400">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
