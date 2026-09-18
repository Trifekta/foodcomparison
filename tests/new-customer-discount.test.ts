import { describe, expect, it } from "vitest";
import { newCustomerDiscountStatus } from "@/lib/calculations/new-customer-discount";
import { NEW_CUSTOMER_DISCOUNT_MIN_AED } from "@/lib/constants";

describe("newCustomerDiscountStatus", () => {
  it("says nothing when they never said they're new to Keeta", () => {
    // "not_new" regardless of the Keeta price - the question never applied.
    expect(newCustomerDiscountStatus(false, "10.00")).toBe("not_new");
    expect(newCustomerDiscountStatus(false, "1000.00")).toBe("not_new");
  });

  it("is checked against the Keeta price, not what they typed on their old app", () => {
    // The discount is Keeta's own new-customer offer, so it's the Keeta order
    // that has to clear the minimum - this function only ever sees that
    // number, never the customer's original total.
    expect(newCustomerDiscountStatus(true, `${NEW_CUSTOMER_DISCOUNT_MIN_AED}.00`)).toBe("eligible");
  });

  it("clears the minimum exactly at the threshold", () => {
    expect(newCustomerDiscountStatus(true, "45.00")).toBe("eligible");
  });

  it("falls short one fil under the threshold", () => {
    expect(newCustomerDiscountStatus(true, "44.99")).toBe("below_minimum");
  });

  it("clears comfortably above the threshold", () => {
    expect(newCustomerDiscountStatus(true, "120.00")).toBe("eligible");
  });

  it("falls well short of the threshold", () => {
    expect(newCustomerDiscountStatus(true, "10.00")).toBe("below_minimum");
  });

  it("treats an unparseable total as not applicable rather than throwing", () => {
    expect(newCustomerDiscountStatus(true, "")).toBe("not_new");
  });
});
