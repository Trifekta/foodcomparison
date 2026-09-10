/**
 * The single source of truth for savings maths.
 *
 * Every screen (admin result card, generated customer message, analytics) reads
 * from this module. Do not re-implement the rules in a component.
 */

import {
  formatMinorAsCurrency,
  formatMinorToDecimalString,
  parseAmountToMinor,
} from "./money";

export interface SavingResult {
  /** Difference in fils. Never negative — a pricier alternative yields 0. */
  savingMinor: number;
  /** Positive percentage of the current total, or 0 when there is no saving. */
  savingPercentage: number;
  /** True only when the comparison total is strictly lower than the current total. */
  hasSaving: boolean;
  /** Raw difference in fils, negative when the alternative costs more. Internal use. */
  rawDifferenceMinor: number;
}

/**
 * saving_amount = current_total - comparison_total
 * saving_percentage = saving_amount / current_total * 100
 *
 * When the comparison total is greater than or equal to the current total there
 * is no saving: the customer-facing answer is "no cheaper option found", and we
 * never surface a negative saving.
 */
export function calculateSaving(currentTotalMinor: number, comparisonTotalMinor: number): SavingResult {
  const rawDifferenceMinor = currentTotalMinor - comparisonTotalMinor;
  const hasSaving = rawDifferenceMinor > 0;
  const savingMinor = hasSaving ? rawDifferenceMinor : 0;

  const savingPercentage =
    hasSaving && currentTotalMinor > 0
      ? (savingMinor / currentTotalMinor) * 100
      : 0;

  return { savingMinor, savingPercentage, hasSaving, rawDifferenceMinor };
}

/** Convenience wrapper for decimal strings coming out of the database. */
export function calculateSavingFromStrings(
  currentTotal: string,
  comparisonTotal: string,
): SavingResult | null {
  const current = parseAmountToMinor(currentTotal);
  const comparison = parseAmountToMinor(comparisonTotal);
  if (current === null || comparison === null) return null;
  return calculateSaving(current, comparison);
}

/** Shapes a SavingResult for persistence into numeric(10,2)/numeric(6,2) columns. */
export function toPersistableSaving(result: SavingResult): {
  saving_amount: string;
  saving_percentage: string;
} {
  return {
    saving_amount: formatMinorToDecimalString(result.savingMinor),
    saving_percentage: result.savingPercentage.toFixed(2),
  };
}

/** Display strings for the admin result card and customer message. */
export function formatSaving(result: SavingResult): {
  amount: string;
  percentage: string;
} {
  return {
    amount: formatMinorAsCurrency(result.savingMinor),
    percentage: `${result.savingPercentage.toFixed(1)}%`,
  };
}

/** Buckets used by the validation analytics. Boundaries are in AED. */
export const SAVING_BUCKETS = [
  { key: "0-4.99", label: "AED 0 – 4.99", minMinor: 0, maxMinor: 499 },
  { key: "5-9.99", label: "AED 5 – 9.99", minMinor: 500, maxMinor: 999 },
  { key: "10-19.99", label: "AED 10 – 19.99", minMinor: 1000, maxMinor: 1999 },
  { key: "20+", label: "AED 20+", minMinor: 2000, maxMinor: Number.POSITIVE_INFINITY },
] as const;

export type SavingBucketKey = (typeof SAVING_BUCKETS)[number]["key"];

export function bucketForSaving(savingMinor: number): SavingBucketKey {
  const bucket = SAVING_BUCKETS.find(
    (candidate) => savingMinor >= candidate.minMinor && savingMinor <= candidate.maxMinor,
  );
  return (bucket ?? SAVING_BUCKETS[0]).key;
}
