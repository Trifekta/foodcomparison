import { describe, expect, it } from "vitest";
import {
  NEW_CUSTOMER_DISCOUNT_BELOW_MINIMUM_NOTE,
  NEW_CUSTOMER_DISCOUNT_ELIGIBLE_NOTE,
  UNVERIFIED_TOTAL_NOTE,
  buildResultMessage,
  buildUnavailableMessage,
  buildWhatsAppLink,
  sourceAppLabel,
} from "@/lib/notifications/messages";

describe("buildResultMessage", () => {
  it("writes the saving-found message from the spec example", () => {
    const result = buildResultMessage({
      sourceAppLabel: "Talabat",
      currentTotal: "82.00",
      comparisonTotal: "63.00",
      totalsConfirmed: true,
      newToKeeta: false,
    });

    expect(result.hasSaving).toBe(true);
    // The first line names us: this lands on WhatsApp from a number the
    // customer has never seen, and the preview is the first line and nothing
    // else.
    expect(result.message.split("\n")[0]).toBe(
      "SnipSavor — good news, we found a cheaper option for your order.",
    );
    expect(result.message).toContain("Talabat — AED 82.00");
    expect(result.message).toContain("Keeta — AED 63.00");
    expect(result.message).toContain("AED 19.00");
    expect(result.message).toContain("That's about 23% less.");
    expect(result.message).toContain("Prices and promotions can change");
    expect(result.message.trimEnd().endsWith("— SnipSavor")).toBe(true);
  });

  it("never claims a guaranteed saving", () => {
    const { message } = buildResultMessage({
      sourceAppLabel: "Talabat",
      currentTotal: "82.00",
      comparisonTotal: "63.00",
      totalsConfirmed: true,
      newToKeeta: false,
    });
    expect(message.toLowerCase()).not.toContain("guarantee");
  });

  it("writes the no-saving message when the alternative costs more", () => {
    const result = buildResultMessage({
      sourceAppLabel: "Talabat",
      currentTotal: "65.00",
      comparisonTotal: "66.50",
      totalsConfirmed: true,
      newToKeeta: false,
    });

    expect(result.hasSaving).toBe(false);
    expect(result.savingMinor).toBe(0);
    expect(result.message.split("\n")[0]).toBe(
      "SnipSavor — we checked your order, but couldn't find a better price this time.",
    );
    expect(result.message).toContain("Your current option appears better right now.");
    expect(result.message).not.toContain("You could save");
    expect(result.message).not.toContain("-");
  });

  it("treats an equal total as no saving", () => {
    expect(
      buildResultMessage({
        sourceAppLabel: "Deliveroo",
        currentTotal: "50.00",
        comparisonTotal: "50.00",
        totalsConfirmed: true,
        newToKeeta: false,
      }).hasSaving,
    ).toBe(false);
  });

  it("handles the second acceptance test: AED 50 vs AED 54", () => {
    const result = buildResultMessage({
      sourceAppLabel: "Talabat",
      currentTotal: "50.00",
      comparisonTotal: "54.00",
      totalsConfirmed: true,
      newToKeeta: false,
    });
    expect(result.hasSaving).toBe(false);
    expect(result.message).toContain("Keeta checked:");
    expect(result.message).toContain("AED 54.00");
  });

  it("uses the app name the customer typed for 'Other'", () => {
    const { message } = buildResultMessage({
      sourceAppLabel: "Smiles",
      currentTotal: "40.00",
      comparisonTotal: "35.00",
      totalsConfirmed: true,
      newToKeeta: false,
    });
    expect(message).toContain("Smiles — AED 40.00");
  });
});

describe("delivery links", () => {
  it("builds a wa.me link with the number and the encoded message", () => {
    const link = buildWhatsAppLink("+971501234567", "Good news — AED 19.00 saving");

    expect(link.startsWith("https://wa.me/971501234567?text=")).toBe(true);
    const text = decodeURIComponent(link.split("?text=")[1]);
    expect(text).toBe("Good news — AED 19.00 saving");
  });

  it("keeps newlines intact through the WhatsApp link", () => {
    const { message } = buildResultMessage({
      sourceAppLabel: "Talabat",
      currentTotal: "82.00",
      comparisonTotal: "63.00",
      totalsConfirmed: true,
      newToKeeta: false,
    });
    const link = buildWhatsAppLink("+971501234567", message);
    expect(decodeURIComponent(link.split("?text=")[1])).toBe(message);
  });


});

describe("sourceAppLabel", () => {
  it("names the app once the admin has identified it", () => {
    expect(sourceAppLabel({ source_app: "Talabat" })).toBe("Talabat");
  });

  it("reads correctly when nobody has said which app it was", () => {
    // The customer is not asked, so this is the normal state of a fresh
    // submission. "Your order - AED 34.65" is a message we can send as it is.
    expect(sourceAppLabel({ source_app: "Unknown" })).toBe("Your order");
    expect(sourceAppLabel({ source_app: "" })).toBe("Your order");
  });

  it("still uses the free-text name on rows created when Other was offered", () => {
    expect(sourceAppLabel({ source_app: "Other", source_app_other: "Smiles" })).toBe("Smiles");
  });

  it("does not leave a bare Other in a customer message", () => {
    expect(sourceAppLabel({ source_app: "Other", source_app_other: null })).toBe("Your order");
  });
});

describe("the result link in a message", () => {
  const base = {
    sourceAppLabel: "Talabat",
    currentTotal: "34.65",
    comparisonTotal: "29.00",
    totalsConfirmed: true,
    newToKeeta: false,
  };

  it("sends the customer back to their own result page", () => {
    const { message } = buildResultMessage({
      ...base,
      resultUrl: "https://snipsavor.example/r/0123456789abcdef0123456789abcdef",
    });
    expect(message).toContain("https://snipsavor.example/r/0123456789abcdef0123456789abcdef");
  });

  it("reads perfectly well without one", () => {
    // NEXT_PUBLIC_APP_URL may be unset. A link to localhost in someone's
    // WhatsApp is worse than no link at all.
    const { message } = buildResultMessage(base);
    expect(message).not.toContain("http");
    expect(message).toContain("You could save");
  });
});

describe("buildUnavailableMessage", () => {
  it("names the restaurant, so it reads as a fact and not a failure", () => {
    const message = buildUnavailableMessage({ restaurantName: "Mandarin Oak" });
    expect(message).toContain("couldn't find Mandarin Oak on Keeta");
  });

  it("still works when we never learned the restaurant's name", () => {
    const message = buildUnavailableMessage({ restaurantName: null });
    expect(message).toContain("couldn't rebuild your order on Keeta");
    expect(message).not.toContain("null");
  });

  it("quotes no price, because there is none", () => {
    const message = buildUnavailableMessage({ restaurantName: "Mandarin Oak" });
    expect(message).not.toMatch(/AED\s*\d/);
    expect(message).not.toContain("save");
  });

  it("tells them to order where they were rather than leaving them hanging", () => {
    expect(buildUnavailableMessage({ restaurantName: "ALBAIK" })).toContain(
      "order where you were",
    );
  });

  it("carries the result link when there is one", () => {
    const message = buildUnavailableMessage({
      restaurantName: "ALBAIK",
      resultUrl: "https://snipsavor.example/r/0123456789abcdef0123456789abcdef",
    });
    expect(message).toContain("/r/0123456789abcdef0123456789abcdef");
  });
});

/**
 * The caveat when the checkout screen never arrived.
 *
 * It is deliberately about verification rather than arithmetic. The baseline is
 * whatever the customer typed into the total field, and plenty of people type
 * their real final total straight off their own screen - so a message claiming
 * we "compared the item subtotal" would be a confident statement about their
 * order that happens to be untrue, which is worse than no warning at all.
 */
describe("a comparison whose fees were never shown", () => {
  const base = {
    sourceAppLabel: "Talabat",
    currentTotal: "133.40",
    comparisonTotal: "120.00",
    newToKeeta: false,
  };

  it("says nothing extra when a screenshot settled the bill", () => {
    const { message } = buildResultMessage({ ...base, totalsConfirmed: true });
    expect(message).not.toContain(UNVERIFIED_TOTAL_NOTE);
  });

  it("warns on the saving message when none did", () => {
    const { message } = buildResultMessage({ ...base, totalsConfirmed: false });
    expect(message).toContain(UNVERIFIED_TOTAL_NOTE);
    // Still the message it was: the caveat is added, not substituted.
    expect(message).toContain("You could save");
  });

  it("warns on the no-saving message too", () => {
    // A total typed without fees makes the alternative look worse than it is,
    // so telling somebody to stay put is exactly when this matters.
    const { message } = buildResultMessage({
      ...base,
      comparisonTotal: "150.00",
      totalsConfirmed: false,
    });
    expect(message).toContain(UNVERIFIED_TOTAL_NOTE);
    expect(message).toContain("Your current option appears better right now.");
  });

  it("does not claim we compared a subtotal, because we did not", () => {
    expect(UNVERIFIED_TOTAL_NOTE).not.toMatch(/subtotal/i);
    expect(UNVERIFIED_TOTAL_NOTE).toContain("the total you entered");
  });

  it("keeps the sign-off last, so the caveat does not end the message", () => {
    const { message } = buildResultMessage({ ...base, totalsConfirmed: false });
    expect(message.trimEnd().endsWith("— SnipSavor")).toBe(true);
  });
});

/**
 * Keeta's new-customer discount, checked against the price the admin found
 * (not what the customer typed) once they said yes on step 3.
 */
describe("the new-customer-discount note", () => {
  const base = {
    sourceAppLabel: "Talabat",
    currentTotal: "133.40",
    totalsConfirmed: true,
  };

  it("says nothing when they never said they were new to Keeta", () => {
    const { message } = buildResultMessage({ ...base, comparisonTotal: "60.00", newToKeeta: false });
    expect(message).not.toContain(NEW_CUSTOMER_DISCOUNT_ELIGIBLE_NOTE);
    expect(message).not.toContain(NEW_CUSTOMER_DISCOUNT_BELOW_MINIMUM_NOTE);
  });

  it("says they qualify once the Keeta price clears the minimum", () => {
    const { message } = buildResultMessage({ ...base, comparisonTotal: "45.00", newToKeeta: true });
    expect(message).toContain(NEW_CUSTOMER_DISCOUNT_ELIGIBLE_NOTE);
  });

  it("says they don't qualify when the Keeta price is under the minimum", () => {
    const { message } = buildResultMessage({ ...base, comparisonTotal: "44.99", newToKeeta: true });
    expect(message).toContain(NEW_CUSTOMER_DISCOUNT_BELOW_MINIMUM_NOTE);
  });

  it("is checked against the Keeta price, not the total they typed", () => {
    // currentTotal is well over the minimum here; comparisonTotal is not -
    // and it's the Keeta order the discount minimum belongs to.
    const { message } = buildResultMessage({
      sourceAppLabel: "Talabat",
      currentTotal: "200.00",
      comparisonTotal: "30.00",
      totalsConfirmed: true,
      newToKeeta: true,
    });
    expect(message).toContain(NEW_CUSTOMER_DISCOUNT_BELOW_MINIMUM_NOTE);
  });

  it("says so on the no-saving message too", () => {
    const { message } = buildResultMessage({
      sourceAppLabel: "Talabat",
      currentTotal: "40.00",
      comparisonTotal: "45.00",
      totalsConfirmed: true,
      newToKeeta: true,
    });
    expect(message).toContain("Your current option appears better right now.");
    expect(message).toContain(NEW_CUSTOMER_DISCOUNT_ELIGIBLE_NOTE);
  });

  it("never states a discount percentage - that figure isn't confirmed", () => {
    expect(NEW_CUSTOMER_DISCOUNT_ELIGIBLE_NOTE).not.toMatch(/%|\bpercent\b/i);
    expect(NEW_CUSTOMER_DISCOUNT_BELOW_MINIMUM_NOTE).not.toMatch(/%|\bpercent\b/i);
  });
});
