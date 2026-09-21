import { describe, expect, it } from "vitest";
import {
  cartConfirmedShort,
  mergeReadTotals,
  readTotalOffer,
  totalsAreSettled,
  trustedFinalTotal,
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

describe("trustedFinalTotal", () => {
  it("returns nothing when nothing was read", () => {
    expect(trustedFinalTotal(null)).toBe("");
  });

  it("withholds a lone total with no fee or discount beside it", () => {
    // The exact shape a real customer hit: Keeta's own basket page prints
    // "Order total AED 71.95" in the same type a payment summary uses, but a
    // delivery fee is still to be added once you tap through to checkout.
    // The old code trusted this number anyway, because it only checked that
    // final_total was non-empty - and then silently filled the customer's
    // own total field with it, in the same breath the upload screen was
    // telling them this slot still needed a second look.
    expect(trustedFinalTotal({ ...EMPTY, finalTotal: "71.95" })).toBe("");
  });

  it("returns the total once a fee or discount confirms the bill is settled", () => {
    expect(trustedFinalTotal({ ...EMPTY, finalTotal: "45.90", discount: "7.65" })).toBe("45.90");
  });
});

/**
 * What the read offers the customer as their own total, and what it calls it.
 *
 * Two numbers come out of a screenshot and they are not interchangeable. A
 * settled bill can be compared like for like against the price an admin finds
 * on Keeta, which always includes that app's own fees. A subtotal cannot: put
 * one in the same field unremarked and every saving we quote comes out smaller
 * than the truth, every time, in the same direction.
 *
 * So the rule returns both the figure and its kind, and the kind is what the
 * screens use to name it. Leaving the field empty - which is what this
 * replaced - was safe for the arithmetic and quietly hostile to the customer,
 * who could see the number on the screenshot they had just sent us.
 */
describe("what the read offers as a total", () => {
  it("offers a settled bill as settled", () => {
    const offer = readTotalOffer(totals({ finalTotal: "71.10", deliveryFee: "5.00" }));
    expect(offer).toEqual({ value: "71.10", kind: "settled" });
  });

  it("offers a bare subtotal as a subtotal", () => {
    // The Deliveroo shape: an item list, a subtotal, and the money settled on
    // a screen the customer has not sent yet.
    const offer = readTotalOffer(totals({ subtotal: "64.00" }));
    expect(offer).toEqual({ value: "64.00", kind: "subtotal" });
  });

  it("treats a total printed with no fees beside it as a subtotal, not a bill", () => {
    // The case the old rule threw away entirely. A Keeta basket prints "Order
    // total AED 71.95" in the type a real payment summary uses, with delivery
    // still to be added - so it is a pre-fees figure, and offering it as a
    // final total is the mistake. Offering it as what it is, is not.
    const offer = readTotalOffer(totals({ finalTotal: "71.95" }));
    expect(offer).toEqual({ value: "71.95", kind: "subtotal" });
  });

  it("prefers the printed total over the subtotal line", () => {
    const offer = readTotalOffer(totals({ subtotal: "64.00", finalTotal: "71.95" }));
    expect(offer.value).toBe("71.95");
  });

  it("offers nothing when only fees were read", () => {
    // Adding them up ourselves is precisely what the extraction is forbidden
    // to do, and a figure nobody printed is not evidence of anything.
    expect(readTotalOffer(totals({ deliveryFee: "5.00", serviceFee: "2.70" }))).toEqual({
      value: "",
      kind: "none",
    });
  });

  it("offers nothing when there was no read at all", () => {
    expect(readTotalOffer(null)).toEqual({ value: "", kind: "none" });
    expect(readTotalOffer(EMPTY)).toEqual({ value: "", kind: "none" });
  });

  it("upgrades to the grand total once the checkout screen settles the bill", () => {
    // The journey the customer actually takes: cart first, checkout second.
    const cart = totals({ subtotal: "64.00" });
    expect(readTotalOffer(cart).kind).toBe("subtotal");

    const checkout = totals({ subtotal: "64.00", deliveryFee: "5.00", finalTotal: "71.10" });
    const merged = mergeReadTotals(cart, checkout);
    expect(readTotalOffer(merged)).toEqual({ value: "71.10", kind: "settled" });
  });

  it("never lets a subtotal claim the fees were verified", () => {
    // trustedFinalTotal is the separate question - may we drop the caveat? - and
    // a subtotal must always answer no, however useful it is in the field.
    const subtotalOnly = totals({ subtotal: "64.00" });
    expect(readTotalOffer(subtotalOnly).value).toBe("64.00");
    expect(trustedFinalTotal(subtotalOnly)).toBe("");
  });
});
