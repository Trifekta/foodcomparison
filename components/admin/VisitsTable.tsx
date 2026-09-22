import Link from "next/link";
import {
  visitorGroupByVisit,
  type VisitorGroup,
  type VisitSummary,
  type VisitTotals,
} from "@/lib/calculations/visits";
import { formatDubaiTime } from "@/lib/utils/text";
import { AdLabelCell } from "@/components/admin/AdLabelCell";
import type { AdLabelIndex } from "@/lib/analytics/ad-labels";

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

/** Retries are the signal: one upload is normal, four is somebody struggling - or, now that a
 * visit lasts the day, somebody who came back later to compare a second cart. */
function Screenshots({ count }: { count: number }) {
  if (count === 0) return <span className="text-ink-400">—</span>;
  return (
    <span
      className={
        count > 1 ? "font-bold tabular-nums text-amber-700" : "tabular-nums text-ink-800"
      }
      title={
        count > 1
          ? `${count} screenshots picked today - retries, a replaced image, or a second cart later in the day`
          : undefined
      }
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

/**
 * Says a row is probably not a new person, without hiding that it is a row.
 *
 * The visit stays exactly where it was, with its own id still printed beside
 * this. Somebody checking whether the grouping is sensible needs to see what
 * was grouped, and an admin reading the funnel needs to know this row may not
 * be a new arrival. One line does both.
 */
function SameVisitor({ group }: { group: VisitorGroup }) {
  const others = group.visitIds.length - 1;

  return (
    <span
      className="mt-0.5 block whitespace-nowrap text-[0.7rem] font-medium text-amber-700"
      title={`Same address and browser, within half an hour: ${group.visitIds.join(", ")}. A guess from weak signals - shared wifi and mobile networks can put different people on one address.`}
    >
      Likely same visitor (+{others})
    </span>
  );
}

export function VisitsTable({
  visits,
  totals,
  labels,
  groups,
}: {
  visits: VisitSummary[];
  totals: VisitTotals;
  /**
   * Names for the advert columns. Optional so this table still renders
   * without it - an unlabelled id is a worse read, not a broken page.
   */
  labels?: AdLabelIndex;
  /**
   * Visits that were probably one person. Optional for the same reason: a
   * database without 0025 has no browser strings to group on, and the table
   * should read exactly as it did before rather than fail.
   */
  groups?: VisitorGroup[];
}) {
  const shown = visits.slice(0, MAX_ROWS);
  const hidden = visits.length - shown.length;
  const groupByVisit = groups ? visitorGroupByVisit(groups) : null;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border border-ink-200 bg-white px-4 py-3">
        {[
          { label: "Visits", value: totals.visits, hint: undefined },
          ...(groups
            ? [
                {
                  label: "Likely visitors",
                  value: groups.length,
                  hint: "Visits from one address and browser within half an hour, counted once. A floor, not a fact: shared wifi and carrier networks put different people on one address, so the real number sits between this and Visits.",
                },
              ]
            : []),
          { label: "Uploaded", value: totals.uploaded, hint: undefined },
          { label: "Screenshots", value: totals.screenshots, hint: undefined },
          { label: "Completed", value: totals.completed, hint: undefined },
        ].map((stat) => (
          <div key={stat.label} title={stat.hint}>
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
                <th className="px-4 py-2.5">Source</th>
                <th className="px-4 py-2.5">Campaign</th>
                <th className="px-4 py-2.5">Ad/Creative</th>
                <th className="px-4 py-2.5">Area</th>
                <th className="px-4 py-2.5">Order</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {shown.map((visit) => (
                <tr key={visit.visitId} className={visit.completed ? "bg-emerald-50/40" : undefined}>
                  <td className="px-4 py-2.5">
                    <VisitId id={visit.visitId} />
                    {(() => {
                      const group = groupByVisit?.get(visit.visitId);
                      return group && group.visitIds.length > 1 ? (
                        <SameVisitor group={group} />
                      ) : null;
                    })()}
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
                    {visit.returning ? (
                      <span
                        className="ml-1.5 whitespace-nowrap text-xs font-normal text-ink-500"
                        title="Followed the link to an order sent earlier - this visit never sent one, so it is not counted as completed"
                      >
                        earlier order
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2.5 text-ink-600">
                    <AdLabelCell kind="source" value={visit.utmSource} index={labels} />
                  </td>
                  <td className="px-4 py-2.5 text-ink-600">
                    <AdLabelCell kind="campaign" value={visit.utmCampaign} index={labels} />
                  </td>
                  <td className="px-4 py-2.5 text-ink-600">
                    <AdLabelCell kind="creative" value={visit.utmContent} index={labels} />
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
        A visit is one browser on one day, and the same phone coming back tomorrow is a second
        row. In-app browsers — Instagram&apos;s and Facebook&apos;s — often keep nothing between
        page loads, so one person there can still arrive as several rows; that is what
        &ldquo;Likely visitors&rdquo; counts once and what the note under a visit id marks.
        Nothing here identifies anybody.{" "}
        <Link href="/admin/analytics" className="underline underline-offset-2 hover:text-ink-800">
          The funnel view
        </Link>{" "}
        counts the same events by step instead.
      </p>
    </section>
  );
}
