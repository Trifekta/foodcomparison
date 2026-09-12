import { describe, expect, it } from "vitest";
import {
  ERROR_MESSAGES,
  basketStepSchema,
  cartItemsSchema,
  contactStepSchema,
  submissionFieldsSchema,
  validateImageClientSide,
  whereStepSchema,
} from "@/lib/validation/submission";
import { comparisonTotalSchema } from "@/lib/validation/admin";

const VALID_AREA_ID = "3f7d6d1a-6d8b-4c2f-9d51-3c9e2b7f1a55";

function baseSubmission(overrides: Record<string, unknown> = {}) {
  return {
    restaurantName: "Al Safadi",
    areaId: VALID_AREA_ID,
    currentTotal: "82.00",
    contactType: "whatsapp",
    dialCode: "+971",
    whatsappNumber: "501234567",
    email: "",
    marketingConsent: false,
    ...overrides,
  };
}

describe("amount validation", () => {
  const where = (currentTotal: string) =>
    whereStepSchema.safeParse({ areaId: VALID_AREA_ID, currentTotal });

  it("accepts a normal Dubai order total", () => {
    expect(where("72.50").success).toBe(true);
    expect(where("8").success).toBe(true);
  });

  it("rejects negative, zero, over-precise and oversized amounts", () => {
    for (const bad of ["-5", "0", "0.00", "82.505", "5001", "abc", ""]) {
      expect(where(bad).success, `expected ${bad} to be rejected`).toBe(false);
    }
  });

  it("explains what to do when the amount is missing", () => {
    const result = where("");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(ERROR_MESSAGES.invalidTotal);
    }
  });
});

describe("where step", () => {
  it("requires an area", () => {
    // The area is not a formality: Keeta's fee, its menu and whether the
    // restaurant delivers at all change with the zone, so a comparison quoted
    // without one is not a comparison.
    const result = whereStepSchema.safeParse({ areaId: "", currentTotal: "82.00" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(ERROR_MESSAGES.areaMissing);
    }
  });

  it("asks for the area and the total together", () => {
    const result = whereStepSchema.safeParse({ areaId: "", currentTotal: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.issues.map((issue) => issue.path[0]);
      expect(fields).toContain("areaId");
      expect(fields).toContain("currentTotal");
    }
  });

  it("does not ask which app the customer is ordering from", () => {
    // The screenshot shows it to anyone who looks, so the admin sets it. A
    // submission that never mentions an app is complete.
    expect(submissionFieldsSchema.safeParse(baseSubmission()).success).toBe(true);
    expect(Object.keys(submissionFieldsSchema.parse(baseSubmission()))).not.toContain("sourceApp");
  });
});

describe("contact validation", () => {
  it("accepts a UAE mobile in any of the usual formats", () => {
    for (const number of ["501234567", "050 123 4567", "+971 50 123 4567", "00971501234567"]) {
      const result = contactStepSchema.safeParse({
        contactType: "whatsapp",
        dialCode: "+971",
        whatsappNumber: number,
        email: "",
      });
      expect(result.success, `expected ${number} to be accepted`).toBe(true);
    }
  });

  it("requires only one contact method - email alone is fine", () => {
    const result = contactStepSchema.safeParse({
      contactType: "email",
      dialCode: "+971",
      whatsappNumber: "",
      email: "customer@example.com",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid email when email is the chosen channel", () => {
    const result = contactStepSchema.safeParse({
      contactType: "email",
      dialCode: "+971",
      whatsappNumber: "",
      email: "not-an-email",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toBe(ERROR_MESSAGES.invalidEmail);
  });

  it("tells the customer where to send the result when nothing is given", () => {
    const result = contactStepSchema.safeParse({
      contactType: "whatsapp",
      dialCode: "+971",
      whatsappNumber: "",
      email: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toBe(ERROR_MESSAGES.contactMissing);
  });
});

describe("basket step", () => {
  it("accepts a restaurant name", () => {
    expect(basketStepSchema.safeParse({ restaurantName: "Al Safadi" }).success).toBe(true);
  });

  it("trims before measuring, so whitespace is not a name", () => {
    const result = basketStepSchema.safeParse({ restaurantName: "   " });
    expect(result.success).toBe(false);
    expect(result.success ? null : result.error.issues[0]?.message).toBe(
      ERROR_MESSAGES.restaurantMissing,
    );
  });

  it("stores the trimmed name", () => {
    const result = basketStepSchema.safeParse({ restaurantName: "  Al Safadi  " });
    expect(result.success ? result.data.restaurantName : null).toBe("Al Safadi");
  });

  it("rejects a name that is too long", () => {
    const result = basketStepSchema.safeParse({ restaurantName: "a".repeat(121) });
    expect(result.success).toBe(false);
    expect(result.success ? null : result.error.issues[0]?.message).toBe(
      ERROR_MESSAGES.restaurantTooLong,
    );
  });

  it("requires a restaurant on the whole submission too", () => {
    expect(submissionFieldsSchema.safeParse(baseSubmission({ restaurantName: "" })).success).toBe(
      false,
    );
  });
});

describe("cart items", () => {
  it("accepts no items at all - the list is optional", () => {
    const result = cartItemsSchema.safeParse([]);
    expect(result.success).toBe(true);
  });

  it("accepts a normal list", () => {
    const result = cartItemsSchema.safeParse([
      { name: "Chicken Shawarma", quantity: 2 },
      { name: "Hummus", quantity: 1 },
    ]);
    expect(result.success).toBe(true);
  });

  it("rejects a quantity outside 1-99, matching the database constraint", () => {
    expect(cartItemsSchema.safeParse([{ name: "A", quantity: 0 }]).success).toBe(false);
    expect(cartItemsSchema.safeParse([{ name: "A", quantity: 100 }]).success).toBe(false);
    expect(cartItemsSchema.safeParse([{ name: "A", quantity: 1.5 }]).success).toBe(false);
    expect(cartItemsSchema.safeParse([{ name: "A", quantity: 1 }]).success).toBe(true);
    expect(cartItemsSchema.safeParse([{ name: "A", quantity: 99 }]).success).toBe(true);
  });

  it("rejects a blank name, matching the database constraint", () => {
    expect(cartItemsSchema.safeParse([{ name: "   ", quantity: 1 }]).success).toBe(false);
  });

  it("rejects an item name that is too long", () => {
    expect(cartItemsSchema.safeParse([{ name: "a".repeat(121), quantity: 1 }]).success).toBe(false);
  });

  it("caps the list so a tampered payload cannot insert thousands of rows", () => {
    const many = Array.from({ length: 21 }, () => ({ name: "Item", quantity: 1 }));
    expect(cartItemsSchema.safeParse(many).success).toBe(false);
    expect(cartItemsSchema.safeParse(many.slice(0, 20)).success).toBe(true);
  });

  it("rejects anything that is not a list of items", () => {
    expect(cartItemsSchema.safeParse("Chicken Shawarma").success).toBe(false);
    expect(cartItemsSchema.safeParse({ name: "A", quantity: 1 }).success).toBe(false);
    expect(cartItemsSchema.safeParse([{ name: "A" }]).success).toBe(false);
    expect(cartItemsSchema.safeParse([{ name: "A", quantity: "2" }]).success).toBe(false);
  });
});

describe("full submission", () => {
  it("accepts the acceptance-test submission", () => {
    expect(submissionFieldsSchema.safeParse(baseSubmission()).success).toBe(true);
  });

  it("does not require the optional checkout screenshot", () => {
    // The schema covers fields only; no checkout image is referenced anywhere in it,
    // so a submission without one is complete.
    const result = submissionFieldsSchema.safeParse(baseSubmission());
    expect(result.success).toBe(true);
    expect(Object.keys(result.success ? result.data : {})).not.toContain("checkoutImage");
  });

  it("defaults marketing consent off and keeps it separate from the submission itself", () => {
    const result = submissionFieldsSchema.safeParse(baseSubmission());
    expect(result.success && result.data.marketingConsent).toBe(false);
  });
});

describe("client-side image checks", () => {
  const makeFile = (type: string, size: number) => {
    const file = new File(["x"], "screenshot", { type });
    Object.defineProperty(file, "size", { value: size });
    return file;
  };

  it("accepts JPG, PNG and WEBP", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp"]) {
      expect(validateImageClientSide(makeFile(type, 1024))).toBeNull();
    }
  });

  it("rejects other file types, including SVG and PDF", () => {
    for (const type of ["image/svg+xml", "application/pdf", "text/html", "application/zip"]) {
      expect(validateImageClientSide(makeFile(type, 1024))).toBe(ERROR_MESSAGES.invalidImage);
    }
  });

  it("rejects files over 10 MB", () => {
    expect(validateImageClientSide(makeFile("image/png", 11 * 1024 * 1024))).toBe(
      ERROR_MESSAGES.oversizedImage,
    );
  });
});

describe("admin comparison amount", () => {
  it("accepts zero and normal amounts but rejects negatives", () => {
    expect(comparisonTotalSchema.safeParse("0").success).toBe(true);
    expect(comparisonTotalSchema.safeParse("63.00").success).toBe(true);
    expect(comparisonTotalSchema.safeParse("-1").success).toBe(false);
    expect(comparisonTotalSchema.safeParse("6000").success).toBe(false);
  });
});

describe("the three failures that are nobody's typo", () => {
  const failures = [
    ERROR_MESSAGES.network,
    ERROR_MESSAGES.unreadable,
    ERROR_MESSAGES.serverError,
  ];

  /**
   * These three used to share one sentence, and a screenshot of the failure
   * could not say which had happened - a dropped connection, a body the server
   * could not read, and a crash inside the handler all read the same. Keeping
   * them distinct is the whole point, so it is worth a test rather than a
   * comment somebody will paste over.
   */
  it("says something different for each", () => {
    expect(new Set(failures).size).toBe(failures.length);
  });

  it("tells the customer their answers are still there", () => {
    for (const message of failures) {
      expect(message).toContain("hasn't been lost");
    }
  });
});
