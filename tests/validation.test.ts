import { describe, expect, it } from "vitest";
import {
  ERROR_MESSAGES,
  contactStepSchema,
  locationStepSchema,
  submissionFieldsSchema,
  totalStepSchema,
  validateImageClientSide,
} from "@/lib/validation/submission";
import { comparisonTotalSchema } from "@/lib/validation/admin";

const VALID_AREA_ID = "3f7d6d1a-6d8b-4c2f-9d51-3c9e2b7f1a55";

function baseSubmission(overrides: Record<string, unknown> = {}) {
  return {
    areaId: VALID_AREA_ID,
    sourceApp: "Talabat",
    sourceAppOther: "",
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
  it("accepts a normal Dubai order total", () => {
    expect(totalStepSchema.safeParse({ currentTotal: "72.50" }).success).toBe(true);
    expect(totalStepSchema.safeParse({ currentTotal: "8" }).success).toBe(true);
  });

  it("rejects negative, zero, over-precise and oversized amounts", () => {
    for (const bad of ["-5", "0", "0.00", "82.505", "5001", "abc", ""]) {
      const result = totalStepSchema.safeParse({ currentTotal: bad });
      expect(result.success, `expected ${bad} to be rejected`).toBe(false);
    }
  });

  it("explains what to do when the amount is missing", () => {
    const result = totalStepSchema.safeParse({ currentTotal: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(ERROR_MESSAGES.invalidTotal);
    }
  });
});

describe("location step", () => {
  it("requires an area", () => {
    const result = locationStepSchema.safeParse({
      areaId: "",
      sourceApp: "Talabat",
      sourceAppOther: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(ERROR_MESSAGES.areaMissing);
    }
  });

  it("requires an app name when the customer picks Other", () => {
    const result = locationStepSchema.safeParse({
      areaId: VALID_AREA_ID,
      sourceApp: "Other",
      sourceAppOther: "   ",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path[0]).toBe("sourceAppOther");
    }
  });

  it("accepts Other once it is named", () => {
    expect(
      locationStepSchema.safeParse({
        areaId: VALID_AREA_ID,
        sourceApp: "Other",
        sourceAppOther: "Smiles",
      }).success,
    ).toBe(true);
  });

  it("rejects an app that is not on the list", () => {
    const result = locationStepSchema.safeParse({
      areaId: VALID_AREA_ID,
      sourceApp: "NotAnApp",
      sourceAppOther: "",
    });
    expect(result.success).toBe(false);
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
