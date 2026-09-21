import { describe, expect, it } from "vitest";
import {
  EXAMPLE_COMPARISON,
  EXAMPLE_NEEDS_REAL_DATA,
  aed,
} from "@/lib/customer/example-comparison";

/**
 * The one basket the landing page quotes before anybody has uploaded anything.
 *
 * It is shown twice - as the banner above the fold and in full inside the
 * example sheet - so the thing worth pinning down is that it adds up. A worked
 * example whose column does not reach its own total argues against the product
 * far more effectively than it argues for it.
 */
describe("the landing page's example basket", () => {
  it("adds its lines and delivery up to the price it quotes", () => {
    const { lines, delivery, fromTotal, toTotal } = EXAMPLE_COMPARISON;

    // Seeded through an explicit number: `delivery` is `as const`, so an
    // inferred accumulator narrows to the literal and refuses the sum.
    const from = lines.reduce<number>((total, line) => total + line.from, delivery.from);
    const to = lines.reduce<number>((total, line) => total + line.to, delivery.to);

    expect(fromTotal).toBeCloseTo(from, 2);
    expect(toTotal).toBeCloseTo(to, 2);
  });

  it("quotes a saving that is the difference between its own totals", () => {
    const { fromTotal, toTotal, saved } = EXAMPLE_COMPARISON;

    expect(saved).toBeCloseTo(fromTotal - toTotal, 2);
  });

  it("is cheaper on every line, so the example cannot argue against itself", () => {
    for (const line of EXAMPLE_COMPARISON.lines) {
      expect(line.to).toBeLessThan(line.from);
    }
  });

  /**
   * The guard that keeps a placeholder from quietly becoming the truth.
   *
   * While the figures are invented the page must not print a real app's name
   * above them - that turns a placeholder into a specific, checkable, false
   * claim about somebody else's pricing. The two flags are set in the same
   * commit or not at all.
   */
  it("names no delivery app while its numbers are invented", () => {
    if (EXAMPLE_NEEDS_REAL_DATA) {
      expect(EXAMPLE_COMPARISON.fromApp).toBeNull();
    }
  });

  it("writes money to two places", () => {
    expect(aed(14)).toBe("14.00");
    expect(aed(8.5)).toBe("8.50");
  });
});
