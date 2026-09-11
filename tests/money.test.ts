import { describe, expect, it } from "vitest";
import {
  MoneyParseError,
  formatDecimalStringAsCurrency,
  formatMinorAsCurrency,
  formatMinorToDecimalString,
  formatPercentage,
  parseAmountToMinor,
  toDecimalString,
  withAmountStrings,
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

describe("formatting never takes a page down", () => {
  it("returns nothing rather than throwing on a value it cannot read", () => {
    // Parsing for arithmetic is strict by design. Formatting is display, and a
    // display helper that throws inside a client component breaks the whole
    // page over one odd row.
    for (const bad of ["-5.00", "1.234", "abc", "1e5", "12,50", "99999999"]) {
      expect(() => formatDecimalStringAsCurrency(bad), `for ${bad}`).not.toThrow();
      expect(formatDecimalStringAsCurrency(bad), `for ${bad}`).toBeNull();
    }
  });

  it("still formats the values it can", () => {
    expect(formatDecimalStringAsCurrency("90.90")).toBe("AED 90.90");
    expect(formatDecimalStringAsCurrency(null)).toBeNull();
  });
});

describe("what Postgres actually sends back", () => {
  /**
   * numeric(10,2) crosses PostgREST as a JSON number - 29, not "29.00" - so
   * every row disagrees with the type describing it. That is what produced
   * "C.trim is not a function" and took the submission page down as soon as a
   * comparison had been saved.
   */
  it("turns a numeric column into the string its type promises", () => {
    expect(toDecimalString(29)).toBe("29.00");
    expect(toDecimalString(90.9)).toBe("90.90");
    expect(toDecimalString(0)).toBe("0.00");
  });

  it("leaves a string alone and passes null through", () => {
    expect(toDecimalString("34.65")).toBe("34.65");
    expect(toDecimalString(null)).toBeNull();
    expect(toDecimalString(undefined)).toBeNull();
    expect(toDecimalString("")).toBeNull();
  });

  it("fixes a whole row, and only the money in it", () => {
    const row = withAmountStrings({
      reference_number: "T829B3",
      current_total: 90.9,
      comparison_total: 79,
      saving_amount: 11.9,
      saving_percentage: 13.09,
      restaurant_name: "On The Wood",
      comparison_url: null,
    });

    expect(row).toEqual({
      reference_number: "T829B3",
      current_total: "90.90",
      comparison_total: "79.00",
      saving_amount: "11.90",
      saving_percentage: "13.09",
      restaurant_name: "On The Wood",
      comparison_url: null,
    });
  });

  it("is safe on a projection that has none of them", () => {
    expect(withAmountStrings({ id: "abc", status: "new" })).toEqual({ id: "abc", status: "new" });
  });

  it("gives the fixed row something .trim() can be called on", () => {
    // The literal failure: a number reached a client component that called
    // .trim() on it during render.
    const row = withAmountStrings({ comparison_total: 29 });
    expect(() => String(row.comparison_total).trim()).not.toThrow();
    expect(String(row.comparison_total).trim()).toBe("29.00");
  });
});
