import { describe, expect, it } from "vitest";
import { shouldAutofillTotal } from "@/components/customer/wizard/types";

/**
 * The total is the baseline the whole saving is measured against, so the rule
 * for writing it on somebody's behalf is worth pinning down.
 */
describe("shouldAutofillTotal", () => {
  it("fills an empty field from the checkout screen", () => {
    expect(
      shouldAutofillTotal({ readCheckoutTotal: "40.50", typed: "", lastAutofilled: null }),
    ).toBe(true);
  });

  it("does nothing when the checkout screen gave no total", () => {
    // The cart screen has no final total on it - only an item subtotal - and
    // presenting that as "what you paid" is the mistake this guards against.
    expect(shouldAutofillTotal({ readCheckoutTotal: "", typed: "", lastAutofilled: null })).toBe(
      false,
    );
  });

  it("never writes over a number they typed", () => {
    expect(
      shouldAutofillTotal({ readCheckoutTotal: "40.50", typed: "133.40", lastAutofilled: null }),
    ).toBe(false);
  });

  it("never writes over a correction they made to our own guess", () => {
    // They saw 40.50, decided it was wrong, and typed 44.00. A second render
    // must not quietly put 40.50 back.
    expect(
      shouldAutofillTotal({ readCheckoutTotal: "40.50", typed: "44.00", lastAutofilled: "40.50" }),
    ).toBe(false);
  });

  it("does not re-fill the same number twice", () => {
    expect(
      shouldAutofillTotal({ readCheckoutTotal: "40.50", typed: "40.50", lastAutofilled: "40.50" }),
    ).toBe(false);
  });

  it("replaces its own earlier guess when a new screenshot is read", () => {
    // They swapped the checkout screenshot for a different one; the field still
    // holds what we put there, so it is ours to update.
    expect(
      shouldAutofillTotal({ readCheckoutTotal: "52.00", typed: "40.50", lastAutofilled: "40.50" }),
    ).toBe(true);
  });

  it("fills a field they cleared", () => {
    expect(
      shouldAutofillTotal({ readCheckoutTotal: "40.50", typed: "", lastAutofilled: "12.00" }),
    ).toBe(true);
  });
});
