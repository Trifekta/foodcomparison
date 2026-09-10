import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ValidationMetrics } from "@/lib/calculations/analytics";
import { formatMinorAsCurrency } from "@/lib/calculations/money";

/** Compact "is this business working?" strip. Full breakdowns live in /admin/analytics. */
export function ValidationStrip({ metrics }: { metrics: ValidationMetrics }) {
  const items = [
    { label: "Submissions", value: String(metrics.totalSubmissions) },
    { label: "Compared", value: String(metrics.completedComparisons) },
    {
      label: "Saving found",
      value:
        metrics.completedComparisons > 0
          ? `${metrics.savingFoundPercentage.toFixed(0)}%`
          : "—",
    },
    {
      label: "Avg saving",
      value:
        metrics.savingFoundCount > 0 ? formatMinorAsCurrency(metrics.averageSavingMinor) : "—",
    },
  ];

  return (
    <section
      aria-label="Validation summary"
      className="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-2xl border border-ink-200 bg-white px-4 py-3"
    >
      {items.map((item) => (
        <div key={item.label}>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
            {item.label}
          </p>
          <p className="mt-0.5 text-lg font-bold tabular-nums text-ink-900">{item.value}</p>
        </div>
      ))}
      <Link
        href="/admin/analytics"
        className="ml-auto inline-flex items-center gap-1.5 text-sm font-semibold text-ink-700 hover:text-ink-900"
      >
        Full validation view
        <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
      </Link>
    </section>
  );
}
