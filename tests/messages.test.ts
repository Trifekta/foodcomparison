import { describe, expect, it } from "vitest";
import {
  buildMailtoLink,
  buildResultMessage,
  buildResultSubject,
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
    });

    expect(result.hasSaving).toBe(true);
    expect(result.message).toContain("Good news — we found a cheaper option for your order.");
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
    });
    expect(message.toLowerCase()).not.toContain("guarantee");
  });

  it("writes the no-saving message when the alternative costs more", () => {
    const result = buildResultMessage({
      sourceAppLabel: "Talabat",
      currentTotal: "65.00",
      comparisonTotal: "66.50",
    });

    expect(result.hasSaving).toBe(false);
    expect(result.savingMinor).toBe(0);
    expect(result.message).toContain("we couldn't find a better price this time");
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
      }).hasSaving,
    ).toBe(false);
  });

  it("handles the second acceptance test: AED 50 vs AED 54", () => {
    const result = buildResultMessage({
      sourceAppLabel: "Talabat",
      currentTotal: "50.00",
      comparisonTotal: "54.00",
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
    });
    const link = buildWhatsAppLink("+971501234567", message);
    expect(decodeURIComponent(link.split("?text=")[1])).toBe(message);
  });

  it("builds a mailto link with a subject and body", () => {
    const link = buildMailtoLink("customer@example.com", "Subject line", "Body text");
    expect(link.startsWith("mailto:")).toBe(true);
    expect(link).toContain("subject=Subject%20line");
    expect(link).toContain("body=Body%20text");
  });

  it("titles the email according to the outcome", () => {
    expect(buildResultSubject(true, "FFA-260910-0042")).toContain("could save");
    expect(buildResultSubject(false, "FFA-260910-0042")).toContain("We checked");
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
