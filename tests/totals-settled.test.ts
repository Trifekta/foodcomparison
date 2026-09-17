import { describe, expect, it } from "vitest";
import {
  cartConfirmedShort,
  mergeReadTotals,
  totalsAreSettled,
} from "@/components/customer/wizard/types";
import type { ReadTotals } from "@/components/customer/wizard/types";

const EMPTY: ReadTotals = {
  subtotal: "",
  deliveryFee: "",
  serviceFee: "",
  discount: "",
  finalTotal: "",
};

const totals = (fields: Partial<ReadTotals>): ReadTotals => ({ ...EMPTY, ...fields });

/**
 * Whether the screenshots settled the bill decides two things a customer sees:
 * whether we fill their total in for them, and whether their result carries the
 * caveat about fees we could not check. It used to be answered by counting
 * uploaded files, which is a question about our form rather than about their
 * order.
 */
describe("totalsAreSettled", () => {
  it("accepts a Talabat cart page, which carries the whole payment summary", () => {
    // Taken from a real one: subtotal 51.00, discount -7.65, free delivery,
    // service fee 2.55, total amount 45.90 - all under the items, on the one
    // screen. Three of the four apps that matter here do this.
    expect(
      totalsAreSettled(
        totals({
          subtotal: "51.00",
          discount: "7.65",
          deliveryFee: "0.00",
          serviceFee: "2.55",
          finalTotal: "45.90",
        }),
      ),
    ).toBe(true);
  });

  it("accepts a payment screen even when only one fee line survived the read", () => {
    // OCR routinely loses a line and keeps the next. One fee beside a printed
    // total is still a payment summary, and still more than a bare item list.
    expect(totalsAreSettled(totals({ serviceFee: "2.55", finalTotal: "45.90" }))).toBe(true);
  });

  it("rejects an item list with a subtotal at the bottom", () => {
    // The Deliveroo case: the cart screen totals the food and says nothing
    // about delivery, service or the discount, so the bill is not settled and
    // the second screenshot is genuinely worth asking for.
    expect(totalsAreSettled(totals({ subtotal: "51.00" }))).toBe(false);
  });

  it("rejects fees with no total printed beside them", () => {
    // Nothing is ever added up on our side: the extraction prompt may only copy
    // what is printed. Fees without a total means the total was off-screen.
    expect(totalsAreSettled(totals({ deliveryFee: "5.90", serviceFee: "2.55" }))).toBe(false);
  });

  it("rejects a subtotal that happens to be the only number on screen", () => {
    expect(totalsAreSettled(totals({ subtotal: "51.00", finalTotal: "" }))).toBe(false);
    expect(totalsAreSettled(null)).toBe(false);
  });

  it("is answered across both screenshots, not one slot", () => {
    // Deliveroo: the items and their subtotal on one screen, the money on the
    // next. Neither settles the bill alone; together they do.
    const cart = totals({ subtotal: "51.00" });
    const checkout = totals({ deliveryFee: "5.90", serviceFee: "2.55", finalTotal: "59.45" });

    expect(totalsAreSettled(cart)).toBe(false);
    expect(totalsAreSettled(mergeReadTotals(cart, checkout))).toBe(true);
  });
});

describe("cartConfirmedShort", () => {
  it("stays quiet before anything has been uploaded", () => {
    expect(
      cartConfirmedShort({ hasCartFile: false, cartReading: false, cartSettled: false }),
    ).toBe(false);
  });

  it("stays quiet while the cart screenshot is still being read", () => {
    // The question is still open - escalating here would be a guess dressed
    // up as a finding.
    expect(
      cartConfirmedShort({ hasCartFile: true, cartReading: true, cartSettled: false }),
    ).toBe(false);
  });

  it("escalates once a finished read comes back without a settled bill", () => {
    // The Deliveroo shape: items came back, no payment summary did.
    expect(
      cartConfirmedShort({ hasCartFile: true, cartReading: false, cartSettled: false }),
    ).toBe(true);
  });

  it("stays quiet once the read has already settled the bill", () => {
    expect(
      cartConfirmedShort({ hasCartFile: true, cartReading: false, cartSettled: true }),
    ).toBe(false);
  });
});
