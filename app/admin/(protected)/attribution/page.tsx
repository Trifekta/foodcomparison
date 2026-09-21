import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, MousePointerClick } from "lucide-react";
import { getAttributionSummary, getKeetaClicks } from "@/lib/keeta/report";
import { parseDateRange } from "@/lib/admin/filters";
import { formatDubaiTimestamp } from "@/lib/admin/export";
import { formatDecimalStringAsCurrency } from "@/lib/calculations/money";
import { COMPARISON_APP } from "@/lib/constants";
import type { RawSearchParams } from "@/lib/admin/filters";

export const metadata: Metadata = {
  title: "Attribution",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Who saw a saving and then switched.
 *
 * Deliberately says click-through everywhere and never "order". Every row here
 * is switch intent - somebody tapped the button and we handed them to Keeta -
 * and nothing in this product knows whether they went on to buy. Calling a tap
 * a sale is the one mistake this page exists to make impossible, which is why
 * the conversion column reads "Unknown" rather than being left blank.
 */

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-ink-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</p>
      <p className="mt-1.5 text-2xl font-bold tabular-nums text-ink-900">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-ink-500">{hint}</p> : null}
    </div>
  );
}

export default async function AttributionPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const params = await searchParams;
  const range = parseDateRange(params);

  const [summary, clicks] = await Promise.all([
    getAttributionSummary(range),
    getKeetaClicks(range),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink-900">{COMPARISON_APP} click-throughs</h1>
          <p className="mt-1 text-sm text-ink-600">
            Switch intent, not confirmed orders. Each row is somebody who saw a comparison and
            tapped through to {COMPARISON_APP}.
          </p>
        </div>

        {/* A plain GET form rather than the analytics range picker, which pushes
            to its own path. Nothing here needs JavaScript. */}
        <form className="flex flex-wrap items-end gap-2" method="get">
          <label className="text-xs font-semibold text-ink-600">
            From
            <input
              type="date"
              name="from"
              defaultValue={range.from ?? ""}
              className="mt-1 block min-h-9 rounded-lg border border-ink-200 px-2 text-sm"
            />
          </label>
          <label className="text-xs font-semibold text-ink-600">
            To
            <input
              type="date"
              name="to"
              defaultValue={range.to ?? ""}
              className="mt-1 block min-h-9 rounded-lg border border-ink-200 px-2 text-sm"
            />
          </label>
          <button
            type="submit"
            className="min-h-9 rounded-lg border border-ink-200 bg-white px-3 text-sm font-semibold text-ink-800 hover:bg-ink-50"
          >
            Apply
          </button>
          <Link
            href="/admin/attribution"
            className="min-h-9 px-2 py-2 text-sm font-medium text-ink-500 underline underline-offset-2"
          >
            Clear
          </Link>
        </form>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="Total click-throughs"
          value={String(summary.totalClicks)}
          hint="Every tap, including repeats"
        />
        <Metric
          label="Unique switchers"
          value={String(summary.uniqueClicks)}
          hint="Distinct browser sessions"
        />
        <Metric
          label="Comparisons with a result"
          value={String(summary.comparisonsWithResult)}
          hint="Had a button to tap"
        />
        <Metric
          label="Click-through rate"
          value={`${summary.clickThroughRate}%`}
          hint={`${summary.comparisonsClicked} of them were tapped`}
        />
      </div>

      <section className="overflow-hidden rounded-2xl border border-ink-200 bg-white">
        <h2 className="border-b border-ink-100 px-5 py-3 text-base font-semibold text-ink-900">
          Every click
        </h2>

        {clicks.length === 0 ? (
          <p className="flex items-center gap-2 px-5 py-6 text-sm text-ink-500">
            <MousePointerClick aria-hidden="true" className="h-4 w-4" />
            No click-throughs in this range yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead className="border-b border-ink-100 text-xs uppercase tracking-wide text-ink-500">
                <tr>
                  {[
                    "Clicked",
                    "Comparison",
                    "Restaurant",
                    "From",
                    "Source",
                    "Campaign",
                    "Ad/Creative",
                    "Area",
                    "Original",
                    COMPARISON_APP,
                    "Saving",
                    "Cheaper",
                    "Click ID",
                    "Conversion",
                  ].map((heading) => (
                    <th key={heading} className="whitespace-nowrap px-3 py-2 font-semibold">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {clicks.map((click) => (
                  <tr key={click.click_ref} className="align-top">
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums text-ink-600">
                      {formatDubaiTimestamp(click.clicked_at)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 font-semibold text-ink-900">
                      <Link
                        href={`/admin/submissions/${click.submission_id}`}
                        className="inline-flex items-center gap-1 underline underline-offset-2"
                      >
                        {click.submissions?.reference_number ?? "—"}
                        <ArrowUpRight aria-hidden="true" className="h-3 w-3" />
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-ink-800">{click.restaurant_name ?? "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-ink-600">
                      {click.source_app ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-ink-600">
                      {click.utm_source ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-ink-600">
                      {click.utm_campaign ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-ink-600">
                      {click.utm_content ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-ink-600">
                      {click.area_name ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums text-ink-800">
                      {formatDecimalStringAsCurrency(click.current_total)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums text-ink-800">
                      {formatDecimalStringAsCurrency(click.comparison_total)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums font-semibold text-emerald-700">
                      {formatDecimalStringAsCurrency(click.saving_amount)}
                      {click.saving_percentage !== null ? (
                        <span className="ml-1 text-xs font-medium text-ink-500">
                          {click.saving_percentage}%
                        </span>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-ink-700">
                      {click.keeta_cheaper === null ? "—" : click.keeta_cheaper ? "Yes" : "No"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-ink-500">
                      {click.click_ref}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-ink-600 capitalize">
                      {click.conversion_status.replace("_", " ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="rounded-2xl border border-ink-200 bg-ink-50 p-4 text-sm leading-relaxed text-ink-600">
        <strong className="font-semibold text-ink-900">These are not orders.</strong> A row here
        means somebody tapped through to {COMPARISON_APP} — nothing in this product knows whether
        they went on to buy. Conversion stays <em>Unknown</em> until {COMPARISON_APP} tells us
        otherwise through a referral callback we have not built yet.
      </p>
    </div>
  );
}
