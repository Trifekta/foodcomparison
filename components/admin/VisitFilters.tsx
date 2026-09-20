"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FUNNEL_STEPS } from "@/lib/analytics/funnel";
import { isStepMatch } from "@/lib/calculations/visits";

/**
 * Which day, and how far they got.
 *
 * In the URL rather than in state, like every other filter here, so a view
 * worth acting on is a view worth sending to somebody.
 */
function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function presets(): { label: string; from: string; to: string }[] {
  const now = new Date();
  const today = isoDate(now);
  const yesterday = isoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  const weekAgo = isoDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6));
  return [
    { label: "Today", from: today, to: today },
    { label: "Yesterday", from: yesterday, to: yesterday },
    { label: "Last 7 days", from: weekAgo, to: today },
  ];
}

export function VisitFilters() {
  const router = useRouter();
  const params = useSearchParams();

  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const step = params.get("step") ?? "";
  const rawMatch = params.get("match");
  const match = isStepMatch(rawMatch) ? rawMatch : "reached";

  const push = (next: URLSearchParams) => {
    router.push(next.toString() ? `/admin/live/visits?${next.toString()}` : "/admin/live/visits");
  };

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    push(next);
  };

  const applyPreset = (preset: { from: string; to: string }) => {
    const next = new URLSearchParams(params.toString());
    next.set("from", preset.from);
    next.set("to", preset.to);
    push(next);
  };

  const fieldClass =
    "min-h-10 rounded-lg border border-ink-200 bg-white px-3 text-sm text-ink-800";

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-ink-200 bg-white p-3">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quick date ranges">
        {presets().map((preset) => (
          <button
            key={preset.label}
            type="button"
            aria-pressed={from === preset.from && to === preset.to}
            onClick={() => applyPreset(preset)}
            className={
              from === preset.from && to === preset.to
                ? "min-h-9 rounded-full bg-ink-900 px-3.5 text-sm font-semibold text-white"
                : "min-h-9 rounded-full bg-ink-50 px-3.5 text-sm font-medium text-ink-700 hover:bg-ink-100"
            }
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="visits-from" className="text-xs font-semibold text-ink-500">
            From
          </label>
          <input
            id="visits-from"
            type="date"
            value={from}
            max={to || undefined}
            onChange={(event) => setParam("from", event.target.value)}
            className={fieldClass}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="visits-to" className="text-xs font-semibold text-ink-500">
            To
          </label>
          <input
            id="visits-to"
            type="date"
            value={to}
            min={from || undefined}
            onChange={(event) => setParam("to", event.target.value)}
            className={fieldClass}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="visits-match" className="text-xs font-semibold text-ink-500">
            Show visits that
          </label>
          <select
            id="visits-match"
            value={match}
            onChange={(event) => setParam("match", event.target.value)}
            className={fieldClass}
          >
            <option value="reached">got at least as far as</option>
            <option value="stopped">stopped at</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="visits-step" className="sr-only">
            Step
          </label>
          <select
            id="visits-step"
            value={step}
            onChange={(event) => setParam("step", event.target.value)}
            className={fieldClass}
          >
            <option value="">Any step</option>
            {FUNNEL_STEPS.map((funnelStep) => (
              <option key={funnelStep.event} value={funnelStep.event}>
                {funnelStep.label}
              </option>
            ))}
          </select>
        </div>

        {from || to || step ? (
          <button
            type="button"
            onClick={() => router.push("/admin/live/visits")}
            className="min-h-10 rounded-lg px-2 text-sm font-medium text-ink-600 hover:bg-ink-50"
          >
            Clear
          </button>
        ) : (
          <p className="min-h-10 self-end pb-2.5 text-sm text-ink-500">Today</p>
        )}
      </div>
    </div>
  );
}
