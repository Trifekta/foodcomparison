import { ArrowDown } from "lucide-react";
import type { FunnelStepCount } from "@/lib/analytics/funnel";

/**
 * Where people stop.
 *
 * The bar is share of everyone who opened the wizard, so the shape of the
 * whole funnel is visible at a glance. The number that matters more sits
 * between the rows: what each screen costs. A screen that loses a third of the
 * people who reach it is the thing to fix, whether it is the second or the
 * sixth.
 */
export function FunnelChart({ steps }: { steps: FunnelStepCount[] }) {
  const started = steps[0]?.count ?? 0;

  if (started === 0) {
    return (
      <section className="rounded-2xl border border-ink-200 bg-white p-5">
        <h2 className="text-base font-semibold text-ink-900">Customer funnel</h2>
        <p className="mt-1.5 text-sm text-ink-500">
          Nothing recorded yet. Steps appear here as soon as somebody opens the wizard.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-ink-200 bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-ink-900">Customer funnel</h2>
        <p className="text-sm text-ink-500">Last 30 days · counted by visit</p>
      </div>

      <ol className="mt-4 space-y-1">
        {steps.map((step, index) => (
          <li key={step.event}>
            {index > 0 ? (
              <p
                className={`flex items-center gap-1.5 py-1 pl-1 text-xs font-medium ${
                  step.dropFromPrevious >= 50 ? "text-rose-700" : "text-ink-500"
                }`}
              >
                <ArrowDown aria-hidden="true" className="h-3 w-3" />
                {step.dropFromPrevious.toFixed(0)}% stopped here
              </p>
            ) : null}

            <div className="rounded-xl bg-ink-50 p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="text-sm font-semibold text-ink-900">{step.label}</p>
                <p className="text-sm tabular-nums text-ink-600">
                  <span className="text-base font-bold text-ink-900">{step.count}</span>
                  {index > 0 ? (
                    <span className="ml-2 text-ink-500">{step.shareOfStart.toFixed(0)}% of all</span>
                  ) : null}
                </p>
              </div>
              <div
                className="mt-2 h-2 overflow-hidden rounded-full bg-ink-200"
                role="img"
                aria-label={`${step.count} visits, ${step.shareOfStart.toFixed(0)} percent of those who started`}
              >
                <span
                  className="block h-full rounded-full bg-brand-400"
                  style={{ width: `${Math.max(1, step.shareOfStart)}%` }}
                />
              </div>
            </div>
          </li>
        ))}
      </ol>

      <p className="mt-4 text-xs leading-relaxed text-ink-500">
        A visit is one browser session, not one person - the same phone coming back tomorrow counts
        twice. Nothing here identifies anybody.
      </p>
    </section>
  );
}
