import type { LivePresenceSummary } from "@/lib/calculations/presence";

/**
 * The headline number, and where those people currently are.
 *
 * "Active now" is deliberately the strict count - visits seen within the last
 * two minutes - not the wider table below it, which trails a few minutes
 * longer on purpose so a visit does not just vanish the instant it crosses the
 * line. The two are allowed to disagree; that disagreement is the honest
 * picture of people arriving and drifting off.
 *
 * The chips are not allowed that licence: they split the headline number and
 * nothing else, so "Just arrived" plus every chip beside it is exactly the
 * count above them. Funnel rungs are brand-coloured and the detours beside
 * them (the example link, a food-app tile) are grey, because a detour that
 * looked like a rung would read as progress it is not.
 */
export function LiveNow({ summary }: { summary: LivePresenceSummary }) {
  return (
    <section className="rounded-2xl border border-ink-200 bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
            Active now
          </p>
          <p className="mt-1 text-4xl font-bold tabular-nums text-ink-900">
            {summary.activeCount}
          </p>
        </div>
        <p className="text-sm text-ink-500">Seen in the last 2 minutes</p>
      </div>

      {summary.activeCount > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {summary.arrivedCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-ink-100 px-3 py-1 text-sm font-medium text-ink-700">
              Just arrived
              <span className="tabular-nums text-ink-500">{summary.arrivedCount}</span>
            </span>
          )}
          {summary.byStep.map((step) => (
            <span
              key={step.event}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${
                step.kind === "step"
                  ? "bg-brand-50 text-brand-900"
                  : "bg-ink-100 text-ink-700"
              }`}
            >
              {step.label}
              <span
                className={`tabular-nums ${
                  step.kind === "step" ? "text-brand-700" : "text-ink-500"
                }`}
              >
                {step.count}
              </span>
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
