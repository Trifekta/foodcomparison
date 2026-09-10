import { describe, expect, it } from "vitest";
import {
  MoneyParseError,
  formatDecimalStringAsCurrency,
  formatMinorAsCurrency,
  formatMinorToDecimalString,
  formatPercentage,
  parseAmountToMinor,
} from "@/lib/calculations/money";

describe("parseAmountToMinor", () => {
  it("parses whole and decimal amounts into fils", () => {
    expect(parseAmountToMinor("82")).toBe(8200);
    expect(parseAmountToMinor("82.5")).toBe(8250);
    expect(parseAmountToMinor("82.50")).toBe(8250);
    expect(parseAmountToMinor("0.05")).toBe(5);
  });

  it("returns null for empty input", () => {
    expect(parseAmountToMinor("")).toBeNull();
    expect(parseAmountToMinor(null)).toBeNull();
    expect(parseAmountToMinor(undefined)).toBeNull();
  });

  it("rejects anything that is not a positive two-decimal amount", () => {
    for (const bad of ["-5", "82.505", "abc", "1,000", "8 2", "1e3", "."]) {
      expect(() => parseAmountToMinor(bad)).toThrow(MoneyParseError);
    }
  });
});

describe("formatting", () => {
  it("formats fils back to fixed-2 strings", () => {
    expect(formatMinorToDecimalString(8200)).toBe("82.00");
    expect(formatMinorToDecimalString(5)).toBe("0.05");
    expect(formatMinorToDecimalString(0)).toBe("0.00");
  });

  it("formats currency and percentages for display", () => {
    expect(formatMinorAsCurrency(1900)).toBe("AED 19.00");
    expect(formatDecimalStringAsCurrency("63.00")).toBe("AED 63.00");
    expect(formatDecimalStringAsCurrency(null)).toBeNull();
    expect(formatPercentage("23.17")).toBe("23.2%");
    expect(formatPercentage(null)).toBeNull();
  });
});
