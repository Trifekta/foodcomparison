import { describe, expect, it } from "vitest";
import { usableItems } from "@/components/customer/wizard/types";
import type { CartItemDraft } from "@/components/customer/wizard/types";

/**
 * How a confirmed row gets labelled.
 *
 * This is the only place that decides whether a row counts as the customer's
 * own or as a screenshot read they accepted. Getting it wrong would either
 * credit the model with something a person typed, or - worse - record a
 * correction as though the model had got it right, which would quietly poison
 * any later measurement of how good the reading actually is.
 */

function draft(overrides: Partial<CartItemDraft> = {}): CartItemDraft {
  return {
    key: "k1",
    name: "Chicken Shawarma",
    quantity: 2,
    linePrice: "64.00",
    proposed: null,
    ...overrides,
  };
}

const AS_READ = { name: "Chicken Shawarma", quantity: 2, linePrice: "64.00" };

describe("usableItems", () => {
  it("labels a row the customer typed as theirs", () => {
    expect(usableItems([draft()])[0]?.source).toBe("customer");
  });

  it("labels an untouched suggestion as extracted", () => {
    expect(usableItems([draft({ proposed: AS_READ })])[0]?.source).toBe("extracted");
  });

  it("labels a corrected name as edited", () => {
    const items = usableItems([draft({ name: "Chicken Shawarma Wrap", proposed: AS_READ })]);
    expect(items[0]?.source).toBe("edited");
    expect(items[0]?.name).toBe("Chicken Shawarma Wrap");
  });

  it("labels a corrected quantity as edited", () => {
    expect(usableItems([draft({ quantity: 3, proposed: AS_READ })])[0]?.source).toBe("edited");
  });

  it("labels a corrected price as edited", () => {
    expect(usableItems([draft({ linePrice: "32.00", proposed: AS_READ })])[0]?.source).toBe(
      "edited",
    );
  });

  it("labels a cleared price as edited", () => {
    expect(usableItems([draft({ linePrice: null, proposed: AS_READ })])[0]?.source).toBe("edited");
  });

  it("carries the price through untouched", () => {
    expect(usableItems([draft({ proposed: AS_READ })])[0]?.linePrice).toBe("64.00");
  });

  it("keeps a priceless row", () => {
    const items = usableItems([draft({ linePrice: null })]);
    expect(items[0]?.linePrice).toBeNull();
  });

  it("drops blank rows, whatever their origin", () => {
    const items = usableItems([
      draft({ key: "a", name: "  " }),
      draft({ key: "b", name: "", proposed: AS_READ }),
      draft({ key: "c", name: "Hummus", proposed: null }),
    ]);
    expect(items.map((item) => item.name)).toEqual(["Hummus"]);
  });

  it("trims the stored name but judges the edit on what was typed", () => {
    // Trailing whitespace is not a correction - the name is unchanged.
    const items = usableItems([draft({ name: "Chicken Shawarma", proposed: AS_READ })]);
    expect(items[0]?.name).toBe("Chicken Shawarma");
    expect(items[0]?.source).toBe("extracted");
  });
});
