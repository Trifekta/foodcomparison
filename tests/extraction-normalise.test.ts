import { describe, expect, it } from "vitest";
import { normaliseBasket } from "@/lib/extraction/normalise";
import { emptyBasket, type StructuredBasket } from "@/lib/extraction/schema";

/**
 * Cleaning a model's basket before an admin sees it.
 *
 * The output schema fixes the shape; it fixes nothing about the values. This is
 * the layer that stops an impossible price or quantity reaching the review
 * screen looking like a fact. Its guiding rule: a value that cannot be true is
 * blanked and flagged, never silently dropped - the admin needs to know the
 * model tried to say something there.
 */

function basket(overrides: Partial<StructuredBasket> = {}): StructuredBasket {
  return { ...emptyBasket(), ...overrides };
}

function item(overrides: Partial<StructuredBasket["items"][number]> = {}) {
  return { name: "Chicken Shawarma", quantity: 1, modifiers: [], unit_price: "", line_total: "", ...overrides };
}

describe("normaliseBasket", () => {
  it("passes a clean basket through", () => {
    const result = normaliseBasket(
      basket({
        restaurant_name: "Al Safadi",
        source_app: "Talabat",
        items: [item({ quantity: 2, line_total: "64.00" })],
        final_total: "104.00",
      }),
    );

    expect(result.restaurant_name).toBe("Al Safadi");
    expect(result.items).toEqual([
      { name: "Chicken Shawarma", quantity: 2, modifiers: [], unit_price: "", line_total: "64.00" },
    ]);
    expect(result.final_total).toBe("104.00");
    expect(result.uncertain_fields).toEqual([]);
  });

  it("normalises money to two decimals so comparisons are exact", () => {
    const result = normaliseBasket(basket({ subtotal: "8.5", final_total: "104" }));
    expect(result.subtotal).toBe("8.50");
    expect(result.final_total).toBe("104.00");
  });

  it("tolerates a currency prefix and thousands separators", () => {
    const result = normaliseBasket(basket({ final_total: "AED 1,204.50" }));
    expect(result.final_total).toBe("1204.50");
    expect(result.uncertain_fields).not.toContain("final_total");
  });

  it("blanks and flags a price it could not be", () => {
    // A misplaced decimal turns 85.00 into 850000 - past anything a Dubai food
    // order costs, so it is reported as unreadable rather than passed on.
    const result = normaliseBasket(basket({ final_total: "850000" }));
    expect(result.final_total).toBe("");
    expect(result.uncertain_fields).toContain("final_total");
  });

  it("blanks and flags a price that is not a number", () => {
    const result = normaliseBasket(basket({ subtotal: "about twenty" }));
    expect(result.subtotal).toBe("");
    expect(result.uncertain_fields).toContain("subtotal");
  });

  it("flags a line price it had to discard, keeping the item", () => {
    const result = normaliseBasket(basket({ items: [item({ line_total: "-5.00" })] }));
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.line_total).toBe("");
    expect(result.uncertain_fields).toContain("items[0].line_total");
  });

  it("clamps an impossible quantity and flags it", () => {
    const result = normaliseBasket(basket({ items: [item({ quantity: 5000 })] }));
    expect(result.items[0]?.quantity).toBe(99);
    expect(result.uncertain_fields).toContain("items[0].quantity");
  });

  it("treats a zero quantity as one, and says so", () => {
    const result = normaliseBasket(basket({ items: [item({ quantity: 0 })] }));
    expect(result.items[0]?.quantity).toBe(1);
    expect(result.uncertain_fields).toContain("items[0].quantity");
  });

  it("drops a row with no usable name", () => {
    const result = normaliseBasket(
      basket({ items: [item({ name: "   " }), item({ name: "Hummus" })] }),
    );
    expect(result.items.map((row) => row.name)).toEqual(["Hummus"]);
  });

  it("re-points a flag when an earlier row was dropped", () => {
    // The model flagged items[1]; items[0] is discarded, so what it flagged is
    // now items[0]. Without this the admin's highlight lands on the wrong row.
    const result = normaliseBasket(
      basket({
        items: [item({ name: "" }), item({ name: "Hummus", line_total: "18.00" })],
        uncertain_fields: ["items[1].line_total"],
      }),
    );
    expect(result.items).toHaveLength(1);
    expect(result.uncertain_fields).toContain("items[0].line_total");
    expect(result.uncertain_fields).not.toContain("items[1].line_total");
  });

  it("caps the list and flags that it did", () => {
    const many = Array.from({ length: 40 }, (_, index) => item({ name: `Item ${index}` }));
    const result = normaliseBasket(basket({ items: many }));
    expect(result.items).toHaveLength(20);
    expect(result.uncertain_fields).toContain("items");
  });

  it("strips control characters from names and modifiers", () => {
    const smuggled = `Hum${String.fromCharCode(0)}mus`;
    const result = normaliseBasket(
      basket({ items: [item({ name: smuggled, modifiers: [smuggled] })] }),
    );
    expect(result.items[0]?.name).toBe("Hummus");
    expect(result.items[0]?.modifiers).toEqual(["Hummus"]);
  });

  it("keeps Arabic exactly as the model reported it", () => {
    const arabic = "عصير برتقال طازج";
    const result = normaliseBasket(basket({ items: [item({ name: arabic })] }));
    expect(result.items[0]?.name).toBe(arabic);
  });

  it("preserves the model's own uncertainty flags", () => {
    const result = normaliseBasket(
      basket({ restaurant_name: "Al Safadi", uncertain_fields: ["restaurant_name"] }),
    );
    expect(result.uncertain_fields).toContain("restaurant_name");
  });

  it("defaults the currency rather than leaving it blank", () => {
    expect(normaliseBasket(basket({ currency: "" })).currency).toBe("AED");
  });

  it("does not invent a discount from an empty field", () => {
    const result = normaliseBasket(basket({ discount: "" }));
    expect(result.discount).toBe("");
    expect(result.uncertain_fields).not.toContain("discount");
  });
});
