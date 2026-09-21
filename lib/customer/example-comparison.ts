/**
 * The one comparison the landing page can show before anybody uploads anything.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * TODO(real-data): EVERY NUMBER BELOW IS INVENTED. Replace with one real
 * comparison from the submissions table before this goes in front of paid
 * traffic. See `needsRealData` below, which is what keeps the placeholder
 * visible instead of letting it quietly become the truth.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * It lives here rather than inside the page because it is shown twice - once as
 * the banner above the fold, once in full inside the example sheet - and a
 * screen that quotes two different savings for the same basket is worse than a
 * screen that quotes none. One object, two readers.
 *
 * No restaurant is named, deliberately. Putting a real restaurant's name beside
 * invented prices makes a specific factual claim about a real business, which
 * is a different and much worse thing than a placeholder: it would be wrong
 * about somebody. The basket is described by what is in it instead, which is
 * all the example needs in order to make its point.
 *
 * The totals are derived from the lines rather than written beside them, so the
 * arithmetic on the screen cannot drift away from the arithmetic in the story -
 * a worked example whose column does not add up argues against itself.
 */

export interface ExampleLine {
  name: string;
  /** What the delivery app charged, in AED. */
  from: number;
  /** What the same line cost on Keeta, in AED. */
  to: number;
}

/**
 * True while the figures above are still placeholders.
 *
 * Read by the landing page, which uses it to keep the example sheet's
 * provenance line honest ("an illustration" rather than "a real order we
 * checked"). Flip it to false in the same commit that brings real numbers in,
 * and the wording corrects itself.
 *
 * A constant rather than a code comment because a comment cannot reach the
 * screen. The failure this guards against is not "somebody forgets" - it is
 * "somebody forgets AND the page keeps claiming the numbers are real", and only
 * one of those two is worth engineering against.
 */
export const EXAMPLE_NEEDS_REAL_DATA = true;

const LINES: readonly ExampleLine[] = [
  { name: "Crispy chicken burger", from: 32.0, to: 26.5 },
  { name: "Chicken shawarma wrap", from: 28.0, to: 24.0 },
  { name: "Fries, large", from: 12.0, to: 9.5 },
] as const;

const DELIVERY = { from: 10.0, to: 8.0 } as const;

function sum(pick: (line: ExampleLine) => number): number {
  return LINES.reduce((total, line) => total + pick(line), 0);
}

const fromTotal = sum((line) => line.from) + DELIVERY.from;
const toTotal = sum((line) => line.to) + DELIVERY.to;

export const EXAMPLE_COMPARISON = {
  /**
   * Which app the "before" price came from - or null while it came from
   * nowhere.
   *
   * Null is what keeps a real brand's name off a set of invented prices. The
   * design names Talabat in this slot, and it should, once the figures are a
   * real Talabat order; printed above placeholders it is a specific, checkable,
   * false claim about somebody else's pricing, which is the one kind of
   * placeholder that can do damage outside this codebase. Until then the column
   * is labelled by what it is rather than by whom.
   *
   * Set it to the real app's name in the same commit that brings real numbers.
   */
  fromApp: null as string | null,
  /** What was in the basket, said without naming whose kitchen it came from. */
  basket: "A burger, a wrap and a side",
  lines: LINES,
  delivery: DELIVERY,
  /** The delivery app's total, in AED. */
  fromTotal,
  /** The same basket's total on Keeta, in AED. */
  toTotal,
  /** What the difference is worth, in AED. Never written down by hand. */
  saved: fromTotal - toTotal,
} as const;

/** AED to two places, for every surface that shows one of the numbers above. */
export function aed(amount: number): string {
  return amount.toFixed(2);
}
