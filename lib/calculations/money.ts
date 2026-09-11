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

/**
 * The columns Postgres hands back as numbers rather than strings.
 *
 * numeric(10,2) arrives over PostgREST as a JSON number - 29, not "29.00" - so
 * every row read from `submissions` disagrees with the type that describes it.
 * That is not cosmetic: a number reaching code that expected a string produced
 * "C.trim is not a function" and took the whole submission page down the moment
 * a comparison had been saved.
 */
const AMOUNT_COLUMNS = [
  "current_total",
  "comparison_total",
  "saving_amount",
  "saving_percentage",
] as const;

/** A database numeric as the fixed-2 string the rest of the app assumes. */
export function toDecimalString(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value.toFixed(2) : null;
  }
  return value;
}

/**
 * Makes a row match the type that claims to describe it.
 *
 * Applied where rows enter the app rather than at each use, so there is one
 * place to be right and no caller has to remember. Untouched keys pass through,
 * so it is safe on any projection.
 */
export function withAmountStrings<T extends object>(row: T): T {
  const fixed = { ...row } as Record<string, unknown>;
  for (const column of AMOUNT_COLUMNS) {
    if (column in fixed) fixed[column] = toDecimalString(fixed[column] as string | number | null);
  }
  return fixed as T;
}

/**
 * Formats a database numeric string (or null) for display.
 *
 * Never throws. Parsing for arithmetic is strict on purpose - a malformed
 * amount must not quietly become a number - but formatting is display, and a
 * display helper that throws takes a whole admin page down over one odd row.
 * Nothing shown beats nothing working.
 */
export function formatDecimalStringAsCurrency(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  try {
    const minor = parseAmountToMinor(value);
    return minor === null ? null : formatMinorAsCurrency(minor);
  } catch {
    return null;
  }
}

/** Percentages are stored as numeric(6,2) and displayed with one decimal. */
export function formatPercentage(value: number | string | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  const numeric = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(numeric)) return null;
  return `${numeric.toFixed(1)}%`;
}
