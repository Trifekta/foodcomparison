/**
 * Money helpers.
 *
 * All arithmetic happens in integer minor units (fils, 1/100 AED) so that
 * currency maths never touches binary floating point. Values cross the database
 * boundary as fixed-2 decimal strings, matching numeric(10,2).
 */

export const MINOR_UNITS_PER_AED = 100;

export class MoneyParseError extends Error {}

/** Parses user/database input into integer fils. Returns null for empty input. */
export function parseAmountToMinor(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;

  const raw = typeof input === "number" ? String(input) : input.trim();
  if (raw === "") return null;

  if (!/^\d{1,7}(\.\d{1,2})?$/.test(raw)) {
    throw new MoneyParseError(`Invalid amount: ${raw}`);
  }

  const [whole, fraction = ""] = raw.split(".");
  const fils = fraction.padEnd(2, "0");
  return Number(whole) * MINOR_UNITS_PER_AED + Number(fils);
}

/** Formats integer fils as a fixed-2 decimal string, e.g. 8200 -> "82.00". */
export function formatMinorToDecimalString(minor: number): string {
  const negative = minor < 0;
  const abs = Math.abs(Math.round(minor));
  const whole = Math.floor(abs / MINOR_UNITS_PER_AED);
  const fraction = String(abs % MINOR_UNITS_PER_AED).padStart(2, "0");
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

/** Human-facing money, e.g. 8200 -> "AED 82.00". */
export function formatMinorAsCurrency(minor: number): string {
  return `AED ${formatMinorToDecimalString(minor)}`;
}

/** Formats a database numeric string (or null) for display. */
export function formatDecimalStringAsCurrency(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  const minor = parseAmountToMinor(value);
  return minor === null ? null : formatMinorAsCurrency(minor);
}

/** Percentages are stored as numeric(6,2) and displayed with one decimal. */
export function formatPercentage(value: number | string | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  const numeric = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(numeric)) return null;
  return `${numeric.toFixed(1)}%`;
}
