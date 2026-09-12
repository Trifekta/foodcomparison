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

  const query = new URLSearchParams();
  if (from) query.set("from", from);
  if (to) query.set("to", to);
  const href = query.toString() ? `/admin/report?${query.toString()}` : "/admin/report";

  const fieldClass =
    "min-h-10 rounded-lg border border-ink-200 bg-white px-3 text-sm text-ink-800";

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-ink-200 bg-white p-3">
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
  );
}
