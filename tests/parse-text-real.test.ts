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

// Noon Food. A different shape again: the restaurant lives in the page header
// rather than under a "Cart" label, a promo banner carries a price, the upsell
// section is called something else, and the item's price got merged onto its
// description line by OCR.
const NOON_CART = `10:10 X                         NZ all ail
& Chin Chin - Chinese, Asian & Noodles
€3 Congrats! You saved & 4.90 from this order
Your order
Special Set Menu Serves 1
Vegetable Spring Rolls 16 Oz, No, ...               539.00
Edit
Final price - no coupons apply
(@ne) Congrats! Your delivery is FREE                  []
Pairs well with your order
Res 4           pp             =
      -~0ff ~ -€
Chicken Dim Hot & Sour     Special Set     Mixed Hakk
Sums             Soup [Spicy] Menu Serv... Noodles
B30               B24               B79               B45
Special requests
94 Add cutlery {29
Te I, Sy Wr SUSE, Cy C——                      ~
0 Delivering in 20-30 mins                   Chanda
Home - AIDA TOWER 2 Apartment numbe...  pL
Total order
B 4075                      Place order
[                    @)                     <`;

describe("Noon Food cart screen", () => {
  const { basket } = parseOcrText(NOON_CART);

  it("finds the restaurant in the page header, past the back arrow", () => {
    expect(basket.restaurant_name).toBe("Chin Chin - Chinese, Asian & Noodles");
  });

  it("finds the one ordered item", () => {
    expect(basket.items).toHaveLength(1);
    expect(basket.items[0]?.name).toBe("Special Set Menu Serves 1");
  });

  it("takes the price from the description line onto the item above it", () => {
    // Noon prints the price level with the description, not the name, and OCR
    // reports them as one line. It belongs to "Special Set Menu Serves 1".
    expect(basket.items[0]?.line_total).not.toBe("");
  });

  it("flags a price it cannot prove, rather than guessing at it", () => {
    // "539.00" is the AED glyph welded to 39.00. On the checkout screen that
    // gets repaired outright, because the arithmetic proves it. Here there is
    // no readable total to reconcile against - so the value is left alone and
    // marked for the customer to check, which is the honest answer.
    expect(basket.items[0]?.line_total).toBe("539.00");
    expect(basket.uncertain_fields).toContain("items[0].line_total");
  });

  it("does not treat a promo banner as something you can eat", () => {
    const everything = JSON.stringify(basket).toLowerCase();
    expect(everything).not.toContain("congrats");
    expect(everything).not.toContain("you saved");
    expect(everything).not.toContain("cashback");
  });

  it("stops at 'Pairs well with your order', not just at the phrases Talabat uses", () => {
    const names = basket.items.map((item) => item.name.toLowerCase()).join(" ");
    expect(names).not.toContain("dim");
    expect(names).not.toContain("hakk");
    expect(names).not.toContain("soup");
  });

  it("reads a free delivery banner as a zero fee", () => {
    expect(basket.delivery_fee).toBe("0.00");
  });

  it("never captures the delivery address", () => {
    const everything = JSON.stringify(basket).toLowerCase();
    expect(everything).not.toContain("aida tower");
    expect(everything).not.toContain("apartment");
  });

  it("leaves the total empty rather than reading 4075 as the price", () => {
    // OCR lost the decimal point: "B 4075" is 40.75. There is nothing else on
    // this screen to reconcile against, so guessing would be worse than the
    // customer typing it on the next step, which they do anyway.
    expect(basket.final_total).not.toBe("4075.00");
    expect(basket.final_total).not.toBe("4075");
  });
});
