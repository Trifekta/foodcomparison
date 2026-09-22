import type { AdminDayActivity } from "@/lib/analytics/admin-activity";
import { formatDubaiDate, formatDubaiTime } from "@/lib/utils/text";

/**
 * A day on the dashboard, per person.
 *
 * One block per admin per day rather than a flat list of rows, because the
 * question this page answers is "was the dashboard used, by whom, and when" -
 * and a flat list of every section every person opened buries that under its
 * own detail. The sections are still there, on the line below, in the order
 * they were first opened.
 *
 * Times are Dubai times, like every other time in the dashboard, and the span
 * is deliberately shown as a span: first_seen_at to last_seen_at is what the
 * table actually knows, and printing a single moment would be a smaller claim
 * dressed up as a more precise one.
 */
export function AdminActivityTable({ days }: { days: AdminDayActivity[] }) {
  if (days.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-ink-300 bg-white p-8 text-center">
        <p className="text-sm text-ink-500">Nobody has opened the dashboard in this period.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {days.map((entry) => (
        <div
          key={`${entry.day}-${entry.adminId}`}
          className="rounded-2xl border border-ink-200 bg-white p-4"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="text-sm font-semibold text-ink-900">
              {entry.name}
              {entry.signedIn ? null : (
                <span
                  className="ml-2 text-xs font-medium text-ink-400"
                  title="No sign-in was recorded on this day: an existing session carried over from an earlier one."
                >
                  already signed in
                </span>
              )}
            </p>
            <p className="text-sm text-ink-500">{formatDubaiDate(`${entry.day}T12:00:00Z`)}</p>
          </div>

          <p className="mt-1 text-sm tabular-nums text-ink-600">
            {formatDubaiTime(entry.firstSeenAt)} – {formatDubaiTime(entry.lastSeenAt)}
            <span className="ml-2 text-ink-400">
              {entry.sections.length} {entry.sections.length === 1 ? "section" : "sections"}
            </span>
          </p>

          <ul className="mt-3 flex flex-wrap gap-1.5">
            {entry.sections.map((section) => (
              <li
                key={section.path}
                className="rounded-lg bg-ink-100 px-2.5 py-1 text-xs text-ink-700"
                title={`${section.path} — first opened ${formatDubaiTime(section.firstSeenAt)}, last ${formatDubaiTime(section.lastSeenAt)}`}
              >
                {section.label}
                {section.hits > 1 ? (
                  <span className="ml-1.5 tabular-nums text-ink-400">×{section.hits}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
