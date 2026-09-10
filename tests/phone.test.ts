import { describe, expect, it } from "vitest";
import {
  PhoneNormalisationError,
  maskEmail,
  maskPhone,
  normalisePhone,
} from "@/lib/utils/phone";

describe("normalisePhone", () => {
  it("normalises every common way a Dubai customer types their number", () => {
    const expected = "+971501234567";
    for (const input of [
      "501234567",
      "0501234567",
      "050 123 4567",
      "+971 50 123 4567",
      "971501234567",
      "00971 50 123 4567",
      "(050) 123-4567",
    ]) {
      expect(normalisePhone("+971", input).e164, `input: ${input}`).toBe(expected);
    }
  });

  it("returns digits ready for a wa.me link", () => {
    expect(normalisePhone("+971", "050 123 4567").digits).toBe("971501234567");
  });

  it("supports other dial codes for travellers", () => {
    expect(normalisePhone("+44", "07700 900123").e164).toBe("+447700900123");
  });

  it("rejects numbers that are obviously wrong", () => {
    for (const bad of ["", "12", "abcdef", "0"]) {
      expect(() => normalisePhone("+971", bad)).toThrow(PhoneNormalisationError);
    }
  });

  it("requires a country code", () => {
    expect(() => normalisePhone("", "501234567")).toThrow(PhoneNormalisationError);
  });
});

describe("masking", () => {
  it("shows only the last four digits of a phone number", () => {
    const masked = maskPhone("+971501234567");
    expect(masked).toContain("4567");
    expect(masked).not.toContain("50123");
  });

  it("masks the local part of an email", () => {
    expect(maskEmail("customer@example.com")).toBe("cu•••@example.com");
  });
});
