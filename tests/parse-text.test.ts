import { describe, expect, it } from "vitest";
import { parseOcrText } from "@/lib/extraction/parse-text";

/**
 * The free parser, tested against text OCR really produced.
 *
 * REAL_OCR below is copied verbatim from a tesseract.js run in a browser - the
 * doubled spaces, the collapsed Arabic row, the quantity misread as zero, all
 * of it. Testing against tidied-up input would prove nothing: the whole job of
 * this parser is coping with output that is already damaged.
 */

const REAL_OCR = `Al Safadi Restaurant

2 x Chicken Shawarma Platter            AED 64.00
Extra garlic, No pickles

1 x Hummus Beiruty                      AED 18.00
AED 24.00                        x ٠ ‏عصير برتقال طازج‎
Subtotal                                  AED 106.00
Delivery fee                                   AED 8.00
Discount                                    - AED 10.00
Total                         AED 104.00
`;

describe("parseOcrText, on real OCR output", () => {
  const { basket, empty } = parseOcrText(REAL_OCR);

  it("finds something", () => {
    expect(empty).toBe(false);
  });

  it("reads the restaurant off the top line", () => {
    expect(basket.restaurant_name).toBe("Al Safadi Restaurant");
  });

  it("finds every item", () => {
    expect(basket.items).toHaveLength(3);
  });

  it("separates the item name from its quantity and price", () => {
    expect(basket.items[0]).toMatchObject({
      name: "Chicken Shawarma Platter",
      quantity: 2,
      line_total: "64.00",
    });
  });

  it("attaches the options line to the item above it", () => {
    expect(basket.items[0]?.modifiers).toEqual(["Extra garlic, No pickles"]);
  });

  it("handles a right-to-left row where the price comes first", () => {
    // The killer case: "AED 24.00 ... x 0 عصير برتقال طازج". Taking the last
    // number on the line would price this juice at zero dirhams.
    const juice = basket.items[2];
    expect(juice?.line_total).toBe("24.00");
    expect(juice?.name).toContain("عصير برتقال");
    expect(juice?.name).not.toContain("24");
  });

  it("does not leave a stripped quantity marker in the name", () => {
    expect(basket.items[2]?.name).not.toMatch(/^[x×]\s*\d/);
  });

  it("reads the fees and totals", () => {
    expect(basket.subtotal).toBe("106.00");
    expect(basket.delivery_fee).toBe("8.00");
    expect(basket.discount).toBe("10.00");
    expect(basket.final_total).toBe("104.00");
  });

  it("does not mistake a fee line for something you can eat", () => {
    const names = basket.items.map((item) => item.name.toLowerCase());
    expect(names.some((name) => name.includes("subtotal"))).toBe(false);
    expect(names.some((name) => name.includes("delivery"))).toBe(false);
    expect(names.some((name) => name.includes("total"))).toBe(false);
  });

  it("flags the restaurant, which rules can never be sure of", () => {
    expect(basket.uncertain_fields).toContain("restaurant_name");
  });

  it("does not flag prices it has no evidence against", () => {
    // Flagging every price is the same as flagging none - the customer stops
    // looking. These three all sit under the stated total, so they stand.
    expect(basket.uncertain_fields).not.toContain("items[0].line_total");
  });
});

describe("parseOcrText, edge cases", () => {
  it("reports an unreadable screenshot as empty rather than inventing a basket", () => {
    expect(parseOcrText("|| ~~ ### %%%").empty).toBe(true);
    expect(parseOcrText("").empty).toBe(true);
  });

  it("prefers subtotal over total, since one contains the other", () => {
    const { basket } = parseOcrText("Subtotal AED 50.00\nTotal AED 58.00");
    expect(basket.subtotal).toBe("50.00");
    expect(basket.final_total).toBe("58.00");
  });

  it("lets the last total win when a receipt states several", () => {
    const { basket } = parseOcrText("Total AED 50.00\nGrand Total AED 58.00");
    expect(basket.final_total).toBe("58.00");
  });

  it("keeps the first delivery fee when a promo strikes one through", () => {
    const { basket } = parseOcrText("Delivery fee AED 8.00\nDelivery fee AED 0.00");
    expect(basket.delivery_fee).toBe("8.00");
  });

  it("reads a trailing quantity", () => {
    const { basket } = parseOcrText("Chicken Wings x3 AED 45.00");
    expect(basket.items[0]).toMatchObject({ name: "Chicken Wings", quantity: 3 });
  });

  it("converts Arabic-Indic digits", () => {
    const { basket } = parseOcrText("شاورما ٢ x AED ٣٢.٥٠");
    expect(basket.items[0]?.line_total).toBe("32.50");
  });

  it("never prices an item from a bare number with no currency marker", () => {
    // "Coke 2" is a quantity beside a name, not a two-dirham drink. The item is
    // still worth listing - it just arrives without a price for the customer to
    // fill in or ignore.
    const { basket } = parseOcrText("Al Safadi\nCoke 2");
    expect(basket.items[0]?.line_total).toBe("");
  });

  it("ignores app chrome at the top of the screenshot", () => {
    const { basket } = parseOcrText("Cart\nAl Safadi\nBurger AED 30.00");
    expect(basket.restaurant_name).toBe("Al Safadi");
  });

  it("does not treat a fee as the restaurant when the name is missing", () => {
    const { basket } = parseOcrText("Burger AED 30.00\nTotal AED 38.00");
    expect(basket.restaurant_name).toBe("");
    expect(basket.items).toHaveLength(1);
  });

  it("caps how many option lines glue onto one item", () => {
    const noise = Array.from({ length: 20 }, (_, i) => `option ${i}`).join("\n");
    const { basket } = parseOcrText(`Al Safadi\nBurger AED 30.00\n${noise}`);
    expect(basket.items[0]?.modifiers.length).toBeLessThanOrEqual(6);
  });

  it("still finds the restaurant and an item when no price survives OCR", () => {
    const { basket, empty } = parseOcrText("Al Safadi\nChicken Shawarma\nHummus");
    expect(empty).toBe(false);
    expect(basket.restaurant_name).toBe("Al Safadi");
    expect(basket.items[0]?.name).toBe("Chicken Shawarma");
    expect(basket.items[0]?.line_total).toBe("");
  });

  it("uses the gaps between rows to tell items from their descriptions", () => {
    // Without blank lines there is nothing to separate a second item from the
    // first item's description, so this is the signal the parser leans on.
    const { basket } = parseOcrText(
      "Al Safadi\n\nBurger AED 30.00\nNo onions\n\nFries AED 12.00",
    );
    expect(basket.items).toHaveLength(2);
    expect(basket.items[0]?.modifiers).toEqual(["No onions"]);
    expect(basket.items[1]?.name).toBe("Fries");
  });
});
