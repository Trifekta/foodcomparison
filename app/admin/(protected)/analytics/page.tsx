import type { Metadata } from "next";
import { getAnalyticsRows } from "@/lib/admin/queries";
import { computeValidationMetrics, type CountByLabel } from "@/lib/calculations/analytics";
import { formatMinorAsCurrency } from "@/lib/calculations/money";

export const metadata: Metadata = {
  title: "Validation",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-ink-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</p>
      <p className="mt-1.5 text-2xl font-bold tabular-nums text-ink-900">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-ink-500">{hint}</p> : null}
    </div>
  );
}

function BreakdownList({
  title,
  items,
  total,
}: {
  title: string;
  items: CountByLabel[];
  total: number;
}) {
  return (
    <section className="rounded-2xl border border-ink-200 bg-white p-5">
      <h2 className="text-base font-semibold text-ink-900">{title}</h2>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-ink-500">Nothing to show yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((item) => {
            const share = total > 0 ? (item.count / total) * 100 : 0;
            return (
              <li key={item.label}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-ink-700">{item.label}</span>
                  <span className="tabular-nums font-semibold text-ink-900">
                    {item.count}
                    <span className="ml-1.5 font-normal text-ink-400">{share.toFixed(0)}%</span>
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
                  <div className="h-full rounded-full bg-brand-400" style={{ width: `${share}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default async function AdminAnalyticsPage() {
  const rows = await getAnalyticsRows();
  const metrics = computeValidationMetrics(rows);

  const savingTotal = metrics.savingDistribution.reduce((sum, bucket) => sum + bucket.count, 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-ink-900">Validation</h1>
        <p className="mt-1 text-sm text-ink-500">
          The numbers that tell us whether this is a business: how often switching apps genuinely
          saves money, and by how much.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Total submissions" value={String(metrics.totalSubmissions)} />
        <Metric
          label="Completed comparisons"
          value={String(metrics.completedComparisons)}
          hint="A competitor total was entered"
        />
        <Metric
          label="Couldn't compare"
          value={String(metrics.unavailableCount)}
          hint={
            metrics.totalSubmissions > 0
              ? `${metrics.unavailablePercentage.toFixed(1)}% of submissions`
              : "No submissions yet"
          }
        />
        <Metric
          label="Saving found"
          value={String(metrics.savingFoundCount)}
          hint={
            metrics.completedComparisons > 0
              ? `${metrics.savingFoundPercentage.toFixed(1)}% of comparisons`
              : "No comparisons yet"
          }
        />
        <Metric
          label="No saving"
          value={
            metrics.completedComparisons > 0
              ? `${metrics.noSavingPercentage.toFixed(1)}%`
              : "—"
          }
          hint="Customer's app was already cheaper"
        />
        <Metric
          label="Average saving"
          value={
            metrics.savingFoundCount > 0
              ? formatMinorAsCurrency(metrics.averageSavingMinor)
              : "—"
          }
          hint="When a saving was found"
        />
        <Metric
          label="Average saving %"
          value={
            metrics.savingFoundCount > 0
              ? `${metrics.averageSavingPercentage.toFixed(1)}%`
              : "—"
          }
          hint="When a saving was found"
        />
      </div>

      <section className="rounded-2xl border border-ink-200 bg-white p-5">
        <h2 className="text-base font-semibold text-ink-900">Saving distribution</h2>
        <p className="mt-1 text-sm text-ink-500">
          Are people saving AED 5, or AED 20+? This is what decides whether the service is worth
          switching for.
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-4">
          {metrics.savingDistribution.map((bucket) => (
            <li key={bucket.key} className="rounded-xl border border-ink-200 bg-ink-50 p-3.5">
              <p className="text-xs font-semibold text-ink-500">{bucket.label}</p>
              <p className="mt-1 text-xl font-bold tabular-nums text-ink-900">{bucket.count}</p>
              <p className="text-xs text-ink-400">
                {savingTotal > 0 ? `${((bucket.count / savingTotal) * 100).toFixed(0)}%` : "—"}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <BreakdownList
          title="Submissions by area"
          items={metrics.byArea}
          total={metrics.totalSubmissions}
        />
        <BreakdownList
          title="Submissions by source app"
          items={metrics.bySourceApp}
          total={metrics.totalSubmissions}
        />
      </div>

      {/*
        The ceiling on everything above it. However good the savings are, they
        only reach the orders that can be compared at all - and the named list
        says exactly which restaurants are standing in the way.
      */}
      {metrics.unavailableCount > 0 ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <BreakdownList
            title="Why we couldn't compare"
            items={metrics.unavailableByReason}
            total={metrics.unavailableCount}
          />
          <BreakdownList
            title="Restaurants we couldn't find"
            items={metrics.unavailableRestaurants}
            total={metrics.unavailableCount}
          />
        </div>
      ) : null}
    </div>
  );
}
