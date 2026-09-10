import { describe, expect, it } from "vitest";
import { parseOcrText } from "@/lib/extraction/parse-text";

/**
 * Regression tests from real screenshots, with real OCR output.
 *
 * Both strings below are verbatim tesseract output (English only, the customer
 * configuration) for screenshots a person actually took of a Talabat ALBAIK
 * order. Nothing is tidied. The first version of the parser produced garbage on
 * these - the phone's status bar as the restaurant, an upsell price row as the
 * only item, the real order missed entirely - because it assumed a price always
 * sits on the same line as its item. Talabat stacks them vertically.
 *
 * Add new screenshots here as they break things. This file is the record of
 * what the free parser can actually cope with.
 */

// Cart screen. The order is ONE item at 36.00; everything under "You might also
// like..." is an upsell, and the cutlery block is a settings toggle.
const ALBAIK_CART = `8:28 @ i» °                       Nf al BL (39)
Cart
<     ALBAIK
Big Baik Combo
Spicy Big BAIK, French Fries, Pepsi -                    :
Diet, ALBAIK Chips                                         ;
2. Edit                                !
og 1 +
8 36.00
You might also like...
C a             =
          |     wm
=              > |               <
1               =|
+               C+                +
Nugget Sauce       Garlic Sauce         Water                  Cock
B 2.50                B 2.50                B 3.50                B 3.5
Special request
Cutlery
Pq    Reduce waste. Select this option only if you
really need cutlery.
0   Any special requests?
Anything else we need to know?
Add items                      Checkout
I                    O                     <`;

// Checkout screen for the same order. The AED symbol has been OCR'd into the
// digits: "836.00" is 36.00, "51.80" is 1.80, "£37.80" is 37.80.
const ALBAIK_CHECKOUT = `Cart
<     ALBAIK

Special request

Cutlery
Pq    Reduce waste. Select this option only if you

really need cutlery.
0   Any special requests?

Anything else we need to know?
Save on your order

[5] Enter voucher code                            Submit

Payment summary
Subtotal                                                         836.00
Free delivery E@                                       E00
Service fee ®                                                   51.80
Total amount                                               £37.80`;

describe("ALBAIK cart screen", () => {
  const { basket } = parseOcrText(ALBAIK_CART);

  it("skips the phone's status bar", () => {
    expect(basket.restaurant_name).not.toContain("8:28");
    expect(basket.restaurant_name).not.toMatch(/\d{1,2}:\d{2}/);
  });

  it("finds the restaurant behind the back arrow", () => {
    expect(basket.restaurant_name).toBe("ALBAIK");
  });

  it("finds the one item that was actually ordered", () => {
    expect(basket.items).toHaveLength(1);
    expect(basket.items[0]?.name).toBe("Big Baik Combo");
  });

  it("carries the price down from its own line", () => {
    // Talabat prints "36.00" five lines below the item name.
    expect(basket.items[0]?.line_total).toBe("36.00");
  });

  it("keeps the combo contents as options", () => {
    expect(basket.items[0]?.modifiers.join(" ")).toContain("Spicy Big BAIK");
  });

  it("does not offer the customer upsells they never ordered", () => {
    const names = basket.items.map((item) => item.name.toLowerCase()).join(" ");
    expect(names).not.toContain("nugget");
    expect(names).not.toContain("garlic");
    expect(names).not.toContain("water");
  });

  it("does not turn the upsell price row into an item", () => {
    expect(basket.items.map((item) => item.name)).not.toContain("B 2.50 B 2.50 B 3.50 B");
  });

  it("does not treat the cutlery blurb as food", () => {
    const everything = JSON.stringify(basket.items).toLowerCase();
    expect(everything).not.toContain("cutlery");
    expect(everything).not.toContain("reduce waste");
    expect(everything).not.toContain("special request");
  });
});

describe("ALBAIK checkout screen", () => {
  const { basket } = parseOcrText(ALBAIK_CHECKOUT);

  it("still reads the totals past the upsell and settings sections", () => {
    expect(basket.final_total).toBe("37.80");
  });

  it("repairs a currency symbol that OCR merged into the number", () => {
    // "836.00" is the AED glyph plus 36.00. The arithmetic proves it: only
    // 36.00 + 0 + 1.80 reconciles with the stated 37.80.
    expect(basket.subtotal).toBe("36.00");
    expect(basket.service_fee).toBe("1.80");
  });

  it("reads a struck-through free delivery as free", () => {
    expect(basket.delivery_fee).toBe("0.00");
  });

  it("finds no items on a checkout screen, rather than inventing them", () => {
    expect(basket.items).toHaveLength(0);
  });
});
