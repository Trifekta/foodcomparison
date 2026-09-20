import Link from "next/link";
import type { VisitSummary, VisitTotals } from "@/lib/calculations/visits";
import { formatDubaiTime } from "@/lib/utils/text";

/**
 * One row per visit, which is the only view that answers "what did this one
 * person do" - the funnel counts distinct visits per step and so flattens
 * three uploads by one person into a single tick.
 *
 * The id is shown short. It is a random per-visit value that identifies
 * nobody, and printing all 16 characters buys nothing but a column that
 * pushes the numbers off a phone screen; eight is plenty to tell two rows
 * apart and to quote one back when asking about it.
 */
function VisitId({ id }: { id: string }) {
  return (
    <span className="font-mono text-xs text-ink-500" title={id}>
      {id.slice(0, 8)}
    </span>
  );
}

/** Retries are the signal: one upload is normal, four is somebody struggling. */
function Screenshots({ count }: { count: number }) {
  if (count === 0) return <span className="text-ink-400">—</span>;
  return (
    <span
      className={
        count > 1 ? "font-bold tabular-nums text-amber-700" : "tabular-nums text-ink-800"
      }
      title={count > 1 ? `${count} screenshots picked - a retry, or a replaced image` : undefined}
    >
      {count}
    </span>
  );
}

/**
 * How many rows reach the page.
 *
 * The totals above the table are computed over everything, so a cap here
 * changes what is listed and never what is counted. It exists because this
 * table is re-rendered every fifteen seconds by the page it sits on, and an
 * uncapped range is an unbounded amount of HTML built four times a minute.
 */
const MAX_ROWS = 200;

export function VisitsTable({
  visits,
  totals,
}: {
  visits: VisitSummary[];
  totals: VisitTotals;
}) {
  const shown = visits.slice(0, MAX_ROWS);
  const hidden = visits.length - shown.length;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-ink-200 bg-white px-4 py-3">
        {[
          { label: "Visits", value: totals.visits },
          { label: "Uploaded", value: totals.uploaded },
          { label: "Screenshots", value: totals.screenshots },
          { label: "Completed", value: totals.completed },
        ].map((stat) => (
          <div key={stat.label}>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
              {stat.label}
            </p>
            <p className="mt-0.5 text-lg font-bold tabular-nums text-ink-900">{stat.value}</p>
          </div>
        ))}
      </div>

      {visits.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-300 bg-white p-8 text-center">
          <p className="text-sm text-ink-500">No visits match this range and step.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-white">
          <table className="w-full min-w-[42rem] text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
                <th className="px-4 py-2.5">Visit</th>
                <th className="px-4 py-2.5">Started</th>
                <th className="px-4 py-2.5">Last seen</th>
                <th className="px-4 py-2.5 text-right">Shots</th>
                <th className="px-4 py-2.5">Got as far as</th>
                <th className="px-4 py-2.5">Area</th>
                <th className="px-4 py-2.5">Order</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {shown.map((visit) => (
                <tr key={visit.visitId} className={visit.completed ? "bg-emerald-50/40" : undefined}>
                  <td className="px-4 py-2.5">
                    <VisitId id={visit.visitId} />
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-ink-600">
                    {formatDubaiTime(visit.firstSeen)}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-ink-600">
                    {formatDubaiTime(visit.lastSeen)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Screenshots count={visit.screenshots} />
                  </td>
                  <td
                    className={`px-4 py-2.5 ${
                      visit.completed ? "font-semibold text-emerald-700" : "text-ink-800"
                    }`}
                  >
                    {visit.furthestLabel}
                  </td>
                  <td className="px-4 py-2.5 text-ink-600">{visit.areaName ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    {visit.reference ? (
                      <span className="font-semibold tabular-nums text-ink-900">
                        {visit.reference}
                      </span>
                    ) : (
                      <span className="text-ink-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {hidden > 0 ? (
        <p className="text-xs font-medium text-ink-600">
          Showing the {MAX_ROWS} most recent of {visits.length} visits. The totals above count all
          of them — narrow the dates to list the rest.
        </p>
      ) : null}

      <p className="text-xs text-ink-500">
        A visit is one browser session, not one person — the same phone coming back tomorrow is two
        rows. Nothing here identifies anybody.{" "}
        <Link href="/admin/analytics" className="underline underline-offset-2 hover:text-ink-800">
          The funnel view
        </Link>{" "}
        counts the same events by step instead.
      </p>
    </section>
  );
}
