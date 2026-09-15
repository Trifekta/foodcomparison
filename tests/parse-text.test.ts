import { describe, expect, it } from "vitest";
import { parseOcrText } from "@/lib/extraction/parse-text";
import { itemTitle } from "@/lib/extraction/normalise";

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

  it("places a fee's lost decimal point when the arithmetic proves it", () => {
    const { basket } = parseOcrText(
      "Subtotal AED 35.00\nDelivery fee 5490\nTotal amount AED 39.90",
    );
    expect(basket.delivery_fee).toBe("4.90");
  });

  it("leaves the row off when nothing reconciles", () => {
    // 35.00 with any reading of "5490" - 54.90 or 4.90 - misses 50.00. A fee
    // nobody can place is worth less to the customer than a blank row, and far
    // less than AED 5,490.
    const { basket } = parseOcrText(
      "Subtotal AED 35.00\nDelivery fee 5490\nTotal amount AED 50.00",
    );
    expect(basket.delivery_fee).toBe("");
  });

  it("leaves the rows off when two readings both reconcile", () => {
    // Both fees came through as "500", and 35.00 reaches 40.00 whether it is
    // the delivery that costs 5.00 or the service. Two answers means guessing,
    // so neither is taken.
    const { basket } = parseOcrText(
      "Subtotal AED 35.00\nDelivery fee 500\nService fee 500\nTotal amount AED 40.00",
    );
    expect(basket.delivery_fee).toBe("");
    expect(basket.service_fee).toBe("");
  });

  it("does not reconstruct a fee with no total to check it against", () => {
    const { basket } = parseOcrText("Al Safadi\nBurger AED 30.00\nDelivery fee 5490");
    expect(basket.delivery_fee).toBe("");
  });

  it("flags a figure it reconstructed, and leaves the ones it read alone", () => {
    const { basket } = parseOcrText(
      "Subtotal AED 35.00\nDelivery fee 5490\nTotal amount AED 39.90",
    );
    expect(basket.uncertain_fields).toContain("delivery_fee");
    expect(basket.uncertain_fields).not.toContain("subtotal");
  });

  it("does not read an offer of free delivery as the delivery fee", () => {
    // "Add AED 2.00 to get free delivery" has a fee word, a price and the word
    // free. It is still an offer the customer has not taken.
    const { basket } = parseOcrText(
      "Subtotal AED 35.00\nAdd AED 2.00 to get free delivery\nDelivery fee AED 4.90\nTotal AED 39.90",
    );
    expect(basket.delivery_fee).toBe("4.90");
  });

  it("still reads a delivery that really is free", () => {
    const { basket } = parseOcrText("Subtotal AED 35.00\nYour delivery is FREE\nTotal AED 35.00");
    expect(basket.delivery_fee).toBe("0.00");
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

/**
 * Tax is a charge, not a dish.
 *
 * There is no financial key for tax - the breakdown kept here is subtotal,
 * fees, discount and total - so a VAT row has nothing above it to claim it and
 * falls through to the item rules carrying a name and a price. It was being
 * listed among the food on every app that itemises it.
 */
describe("a tax line", () => {
  const RECEIPT = [
    "Al Safadi Restaurant",
    "Mixed Grill Platter        AED 89.00",
    "Hummus                     AED 18.00",
    "Subtotal                   AED 107.00",
    "Delivery fee               AED 5.00",
    "VAT 5%                     AED 5.35",
    "Total                      AED 117.35",
  ].join("\n");

  it("is not one of the items", () => {
    const { basket } = parseOcrText(RECEIPT);
    expect(basket.items.map((item) => item.name)).toEqual(["Mixed Grill Platter", "Hummus"]);
  });

  it("does not disturb the totals around it", () => {
    const { basket } = parseOcrText(RECEIPT);
    expect(basket.subtotal).toBe("107.00");
    expect(basket.delivery_fee).toBe("5.00");
    expect(basket.final_total).toBe("117.35");
  });

  /**
   * The stems are short enough to sit inside a real name, so the rule is
   * deliberately narrow: a dish is never dropped for containing these letters.
   */
  it("does not take a dish whose name happens to contain the letters", () => {
    const { basket } = parseOcrText(
      ["Sultan Grill", "Vatan Special Thali for two people   AED 62.00"].join("\n"),
    );
    expect(basket.items.map((item) => item.name)).toEqual(["Vatan Special Thali for two people"]);
  });
});

/**
 * A discount larger than the thing being discounted.
 *
 * Taken from a real Pizza Hut checkout that reached a customer's screen reading
 * "Discount -AED 8,543.00" against a subtotal of AED 162.00. The repair pass
 * correctly declined to guess - nothing reconciled - and then left the figure
 * exactly as read, which is the right call for a doubtful number and the wrong
 * one for an impossible one. A value like that does not invite checking; it
 * discredits every other figure beside it.
 */
describe("a discount that cannot be right", () => {
  const RECEIPT = [
    "Pizza Hut",
    "Limo Combo                 AED 162.00",
    "Subtotal                   AED 162.00",
    "Delivery                   AED 9.50",
    "Discount                  -AED 8543.00",
    "Total                      AED 133.40",
  ].join("\n");

  /**
   * Cleared, not derived. Subtracting the total from the parts would give 38.10
   * here and the real discount is 43.00 - the difference being a service fee
   * this run did not read. A plausible wrong number is worse than a missing one
   * because nobody checks it, and everything around it survives untouched.
   */
  it("is cleared, and the figures around it are left alone", () => {
    const { basket } = parseOcrText(RECEIPT);
    expect(basket.discount).toBe("");
    expect(basket.subtotal).toBe("162.00");
    expect(basket.delivery_fee).toBe("9.50");
    expect(basket.final_total).toBe("133.40");
  });

  it("is flagged, so the gap in the summary is somebody's to fill", () => {
    const { basket } = parseOcrText(RECEIPT);
    expect(basket.uncertain_fields).toContain("discount");
  });

  /**
   * The bound is only the impossible one. A genuine half-price offer is a large
   * discount and must survive untouched, or this rule costs more than it saves.
   */
  it("leaves an ordinary large discount alone", () => {
    const { basket } = parseOcrText(
      [
        "Pizza Hut",
        "Subtotal AED 162.00",
        "Delivery AED 9.50",
        "Discount -AED 81.00",
        "Total AED 90.50",
      ].join("\n"),
    );
    expect(basket.discount).toBe("81.00");
    expect(basket.uncertain_fields).not.toContain("discount");
  });
});

/**
 * A Pizza Hut combo, from the screenshots a customer actually sent.
 *
 * Two separate faults met here. The combo's description lists what is inside
 * it - "Pepsi (2.25 litres)" - and 2.25 carries a decimal point, which outranks
 * every other signal in the price reader. So the basket showed a Limo Combo
 * costing AED 2.25, and the real 119.00 two lines below was never reached.
 */
describe("a combo whose description contains a measurement", () => {
  const CART = [
    "Cart",
    "Pizza Hut",
    "Limo Combo",
    "Meal, Margherita, Margherita,",
    "Margherita, Limo Combo,",
    "Pepsi (2.25 litres), Creamy",
    "Ranch, Fiery Peri Sauce,",
    "Chipotle BBQ Dip",
    "Edit",
    "B 119.00 B 162.00",
    "You might also like...",
    "Creamy Ranch Dip",
    "B 5.00",
    "Great! You're saving B 43.00",
  ].join("\n");

  it("prices the combo, not the bottle of Pepsi inside it", () => {
    const { basket } = parseOcrText(CART);
    expect(basket.items).toHaveLength(1);
    expect(basket.items[0].line_total).toBe("119.00");
  });

  /** The live price, not the struck-through one beside it. */
  it("takes the discounted price rather than the original", () => {
    const { basket } = parseOcrText(CART);
    expect(basket.items[0].line_total).not.toBe("162.00");
  });

  it("leaves the measurement in the description where it belongs", () => {
    const { basket } = parseOcrText(CART);
    expect(basket.items[0].modifiers.join(" ")).toContain("2.25 litres");
  });

  it("does not take the upsell carousel for part of the order", () => {
    const { basket } = parseOcrText(CART);
    expect(basket.items.map((item) => item.name)).toEqual(["Limo Combo"]);
  });

  /**
   * The same order's payment summary, which reconciles exactly:
   * 162.00 - 43.00 + 9.50 + 4.90 = 133.40.
   */
  it("reads every line of the payment summary", () => {
    const { basket } = parseOcrText(
      [
        "Payment summary",
        "Subtotal B 162.00",
        "Discount - B 43.00",
        "Delivery fee B 9.50",
        "Service fee B 4.90",
        "Total amount B 133.40",
      ].join("\n"),
    );

    expect(basket.subtotal).toBe("162.00");
    expect(basket.discount).toBe("43.00");
    expect(basket.delivery_fee).toBe("9.50");
    expect(basket.service_fee).toBe("4.90");
    expect(basket.final_total).toBe("133.40");
  });
});

describe("cutting an item name back to the dish", () => {
  it("keeps the head of a combo that lists its contents", () => {
    expect(itemTitle("Limo Combo · Meal, Margherita, Margherita, Pepsi (2.25 litres)")).toBe(
      "Limo Combo",
    );
  });

  /** A real name with one comma in it is a name, not a list. */
  it("leaves an ordinary name alone", () => {
    expect(itemTitle("Chicken, Rice")).toBe("Chicken, Rice");
    expect(itemTitle("Fish & Chips")).toBe("Fish & Chips");
    expect(itemTitle("Zinger Burger Meal Large")).toBe("Zinger Burger Meal Large");
  });

  it("never cuts down to something too short to recognise", () => {
    expect(itemTitle("XL, Margherita, Pepperoni, Olives")).toBe("XL, Margherita, Pepperoni, Olives");
  });
});
