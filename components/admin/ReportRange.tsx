"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Download } from "lucide-react";

/**
 * The date range the Validation page is read over, and the download beside it.
 *
 * In the URL rather than in state, for the same reason the submissions filters
 * are: a range somebody wants to act on is a range they want to send to
 * somebody else, and a page that forgets it on refresh cannot be quoted.
 *
 * The download link carries the same two parameters, so the file and the screen
 * can never be a different fortnight.
 */

/** YYYY-MM-DD in whatever timezone the admin's own device is set to - the same
 * assumption the two plain date inputs below already make. */
function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

/** One-tap ranges for the two questions an admin actually asks: "today" and
 * "this/last month". The two date inputs below still cover anything else. */
function presetRanges(): { label: string; from: string; to: string }[] {
  const now = new Date();
  const today = isoDate(now);
  const startOfThisMonth = isoDate(new Date(now.getFullYear(), now.getMonth(), 1));
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
  const startOfLastMonth = new Date(endOfLastMonth.getFullYear(), endOfLastMonth.getMonth(), 1);

  return [
    { label: "Today", from: today, to: today },
    { label: "This month", from: startOfThisMonth, to: today },
    { label: "Last month", from: isoDate(startOfLastMonth), to: isoDate(endOfLastMonth) },
  ];
}

export function ReportRange() {
  const router = useRouter();
  const params = useSearchParams();

  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";

  const apply = (key: "from" | "to", value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(next.toString() ? `/admin/analytics?${next.toString()}` : "/admin/analytics");
  };

  const applyPreset = (preset: { from: string; to: string }) => {
    const next = new URLSearchParams(params.toString());
    next.set("from", preset.from);
    next.set("to", preset.to);
    router.push(`/admin/analytics?${next.toString()}`);
  };

  const query = new URLSearchParams();
  if (from) query.set("from", from);
  if (to) query.set("to", to);
  const href = query.toString() ? `/admin/report?${query.toString()}` : "/admin/report";

  const fieldClass =
    "min-h-10 rounded-lg border border-ink-200 bg-white px-3 text-sm text-ink-800";

  const presets = presetRanges();

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-ink-200 bg-white p-3">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quick date ranges">
        {presets.map((preset) => (
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
          <label htmlFor="report-from" className="text-xs font-semibold text-ink-500">
            From
          </label>
          <input
            id="report-from"
            type="date"
            value={from}
            max={to || undefined}
            onChange={(event) => apply("from", event.target.value)}
            className={fieldClass}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="report-to" className="text-xs font-semibold text-ink-500">
            To
          </label>
          <input
            id="report-to"
            type="date"
            value={to}
            min={from || undefined}
            onChange={(event) => apply("to", event.target.value)}
            className={fieldClass}
          />
        </div>

        {from || to ? (
          <button
            type="button"
            onClick={() => router.push("/admin/analytics")}
            className="min-h-10 rounded-lg px-2 text-sm font-medium text-ink-600 hover:bg-ink-50"
          >
            Clear
          </button>
        ) : (
          <p className="min-h-10 self-end pb-2.5 text-sm text-ink-500">Showing all time</p>
        )}

        {/* A link, not a button: the response is a file, so the browser should
            handle it and nothing here should re-render. */}
        <a
          href={href}
          className="ml-auto inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-ink-200 px-3 text-sm font-medium text-ink-700 hover:bg-ink-50"
        >
          <Download aria-hidden="true" className="h-3.5 w-3.5" />
          Download report
        </a>
      </div>
    </div>
  );
}
