import { randomInt } from "node:crypto";

/**
 * Customer-facing reference, e.g. TRI-260910-0042.
 *
 * TRI + YYMMDD + a random 4-digit suffix. The suffix is random rather than a
 * running sequence so references cannot be walked; the UUID primary key remains
 * the real identifier and nothing is authorised by reference alone.
 */
export const REFERENCE_PREFIX = "TRI";
export const REFERENCE_PATTERN = /^TRI-\d{6}-\d{4}$/;

export function formatReferenceDate(date: Date): string {
  const yy = String(date.getUTCFullYear()).slice(-2);
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${yy}${mm}${dd}`;
}

/** Injectable randomness keeps this testable without stubbing crypto globally. */
export function generateReferenceNumber(
  date: Date = new Date(),
  random: (max: number) => number = (max) => randomInt(max),
): string {
  const suffix = String(random(10000)).padStart(4, "0");
  return `${REFERENCE_PREFIX}-${formatReferenceDate(date)}-${suffix}`;
}

export function isValidReferenceNumber(value: string): boolean {
  return REFERENCE_PATTERN.test(value);
}
