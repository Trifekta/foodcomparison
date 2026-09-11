import { SAVING_BUCKETS, bucketForSaving, type SavingBucketKey } from "./saving";
import { parseAmountToMinor } from "./money";

/**
 * Validation metrics.
 *
 * These are the numbers that tell us whether the business works: how often we
 * actually find a saving, how big it is, and where the demand is. Kept as a pure
 * function over rows so it is testable without a database.
 */

export interface AnalyticsRow {
  status: string;
  source_app: string;
  current_total: string;
  comparison_total: string | null;
  saving_amount: string | null;
  restaurant_name: string | null;
  unavailable_reason: string | null;
  areas: { name: string } | null;
}

export interface CountByLabel {
  label: string;
  count: number;
}

export interface ValidationMetrics {
  totalSubmissions: number;
  completedComparisons: number;
  savingFoundCount: number;
  /** Share of completed comparisons where a saving was found, 0-100. */
  savingFoundPercentage: number;
  noSavingPercentage: number;
  /** Averages across the comparisons where a saving was found, in fils. */
  averageSavingMinor: number;
  averageSavingPercentage: number;
  savingDistribution: Array<{ key: SavingBucketKey; label: string; count: number }>;
  byArea: CountByLabel[];
  bySourceApp: CountByLabel[];
  /**
   * Baskets that could not be priced at all, because the restaurant is not on
   * the comparison app or its menu could not be matched.
   *
   * This is a ceiling, not a footnote: however good the savings are, they only
   * reach the share of orders that can be compared in the first place. The
   * named list is the more actionable half - it says which restaurants the
   * comparison app is missing.
   */
  unavailableCount: number;
  /** Share of every submission that ended with no comparison possible, 0-100. */
  unavailablePercentage: number;
  unavailableByReason: CountByLabel[];
  unavailableRestaurants: CountByLabel[];
}

/** Reasons, in the words the dashboard shows rather than the enum's. */
const UNAVAILABLE_REASON_LABELS: Record<string, string> = {
  restaurant_not_listed: "Restaurant not listed",
  items_not_available: "Items not available",
  other: "Something else",
};

/** A comparison counts as complete once an admin has entered a competitor total. */
function isCompleted(row: AnalyticsRow): boolean {
  return row.comparison_total !== null && row.comparison_total !== "";
}

export function computeValidationMetrics(rows: AnalyticsRow[]): ValidationMetrics {
  const completed = rows.filter(isCompleted);
  const unavailable = rows.filter((row) => row.status === "unavailable");

  let savingFoundCount = 0;
  let savingTotalMinor = 0;
  let savingPercentageTotal = 0;

  const distribution = new Map<SavingBucketKey, number>(
    SAVING_BUCKETS.map((bucket) => [bucket.key, 0]),
  );

  for (const row of completed) {
    const current = parseAmountToMinor(row.current_total) ?? 0;
    const comparison = parseAmountToMinor(row.comparison_total) ?? 0;

    // saving_found is defined as comparison_total < current_total.
    if (comparison >= current) continue;

    const savingMinor = current - comparison;
    savingFoundCount += 1;
    savingTotalMinor += savingMinor;
    savingPercentageTotal += current > 0 ? (savingMinor / current) * 100 : 0;

    const bucket = bucketForSaving(savingMinor);
    distribution.set(bucket, (distribution.get(bucket) ?? 0) + 1);
  }

  const savingFoundPercentage =
    completed.length > 0 ? (savingFoundCount / completed.length) * 100 : 0;

  return {
    totalSubmissions: rows.length,
    completedComparisons: completed.length,
    savingFoundCount,
    savingFoundPercentage,
    noSavingPercentage: completed.length > 0 ? 100 - savingFoundPercentage : 0,
    averageSavingMinor: savingFoundCount > 0 ? Math.round(savingTotalMinor / savingFoundCount) : 0,
    averageSavingPercentage:
      savingFoundCount > 0 ? savingPercentageTotal / savingFoundCount : 0,
    savingDistribution: SAVING_BUCKETS.map((bucket) => ({
      key: bucket.key,
      label: bucket.label,
      count: distribution.get(bucket.key) ?? 0,
    })),
    byArea: countBy(rows, (row) => row.areas?.name ?? "Unknown area"),
    bySourceApp: countBy(rows, (row) => row.source_app),
    unavailableCount: unavailable.length,
    unavailablePercentage: rows.length > 0 ? (unavailable.length / rows.length) * 100 : 0,
    unavailableByReason: countBy(
      unavailable,
      (row) => UNAVAILABLE_REASON_LABELS[row.unavailable_reason ?? ""] ?? "Not recorded",
    ),
    unavailableRestaurants: countBy(
      unavailable,
      (row) => row.restaurant_name?.trim() || "Restaurant not named",
    ),
  };
}

function countBy(rows: AnalyticsRow[], key: (row: AnalyticsRow) => string): CountByLabel[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const label = key(row);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}
