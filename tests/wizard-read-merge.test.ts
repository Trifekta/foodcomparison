import { describe, expect, it } from "vitest";
import {
  combineStatus,
  hasAnyTotal,
  mergeReadTotals,
  type ReadTotals,
} from "@/components/customer/wizard/types";

/**
 * Two screenshots, one set of figures.
 *
 * The customer uploads a cart screen and, optionally, the checkout screen. Both
 * are read. The cart screen says what was ordered; the checkout screen says
 * what it actually came to, after fees and the discount. These are the rules
 * for reconciling them.
 */

const totals = (partial: Partial<ReadTotals>): ReadTotals => ({
  subtotal: "",
  deliveryFee: "",
  serviceFee: "",
  discount: "",
  finalTotal: "",
  ...partial,
});

describe("mergeReadTotals", () => {
  it("has nothing to merge when neither screenshot was read", () => {
    expect(mergeReadTotals(null, null)).toBeNull();
  });

  it("uses the cart screen when no checkout screenshot was added", () => {
    const cart = totals({ subtotal: "35.00", finalTotal: "35.00" });
    expect(mergeReadTotals(cart, null)).toEqual(cart);
  });

  it("lets the checkout screen overrule the cart on the final total", () => {
    // The real Mandarin Oak case: the cart screen shows 35.00 for the item,
    // the payment screen settles at 34.65 once the discount lands.
    const merged = mergeReadTotals(
      totals({ subtotal: "35.00", finalTotal: "35.00" }),
      totals({ subtotal: "35.00", finalTotal: "34.65" }),
    );
    expect(merged?.finalTotal).toBe("34.65");
  });

  it("fills a figure the checkout screen lost from the cart screen", () => {
    // OCR routinely loses one line and not the next. A figure the cart screen
    // did read beats a blank row.
    const merged = mergeReadTotals(
      totals({ deliveryFee: "8.00", finalTotal: "43.00" }),
      totals({ finalTotal: "41.00" }),
    );
    expect(merged).toMatchObject({ deliveryFee: "8.00", finalTotal: "41.00" });
  });

  it("keeps the cart figures when the checkout read came back with no money", () => {
    const cart = totals({ subtotal: "35.00", finalTotal: "35.00" });
    expect(mergeReadTotals(cart, totals({}))).toEqual(cart);
  });

  it("uses the checkout screen alone when the cart screenshot read nothing", () => {
    const checkout = totals({ finalTotal: "34.65" });
    expect(mergeReadTotals(null, checkout)).toEqual(checkout);
  });
});

describe("hasAnyTotal", () => {
  it("is false for nothing read and for a read that found no money", () => {
    expect(hasAnyTotal(null)).toBe(false);
    expect(hasAnyTotal(totals({}))).toBe(false);
  });

  it("is true as soon as one figure survives", () => {
    expect(hasAnyTotal(totals({ discount: "0.35" }))).toBe(true);
  });
});

describe("combineStatus", () => {
  it("is idle before either screenshot is chosen", () => {
    expect(combineStatus("idle", "idle")).toBe("idle");
  });

  it("still says reading while the second screenshot is being read", () => {
    // The figures on screen may yet move, and saying so is more honest than
    // showing a settled result that is about to change.
    expect(combineStatus("applied", "reading")).toBe("reading");
    expect(combineStatus("reading", "idle")).toBe("reading");
  });

  it("reports a result when either screenshot produced one", () => {
    expect(combineStatus("empty", "applied")).toBe("applied");
    expect(combineStatus("applied", "idle")).toBe("applied");
  });

  it("reports empty only when the reads that finished found nothing", () => {
    expect(combineStatus("empty", "idle")).toBe("empty");
    expect(combineStatus("empty", "empty")).toBe("empty");
  });
});
