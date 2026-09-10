import { describe, expect, it } from "vitest";
import {
  bucketForSaving,
  calculateSaving,
  calculateSavingFromStrings,
  formatSaving,
  toPersistableSaving,
} from "@/lib/calculations/saving";
import { formatMinorAsCurrency, parseAmountToMinor } from "@/lib/calculations/money";

describe("calculateSaving", () => {
  it("computes the worked example from the spec: 82.00 - 63.00", () => {
    const result = calculateSaving(8200, 6300);

    expect(result.hasSaving).toBe(true);
    expect(result.savingMinor).toBe(1900);
    expect(formatMinorAsCurrency(result.savingMinor)).toBe("AED 19.00");
    expect(result.savingPercentage).toBeCloseTo(23.17, 2);
    expect(formatSaving(result).percentage).toBe("23.2%");
  });

  it("never reports a negative saving when the alternative costs more", () => {
    const result = calculateSaving(5000, 5400);

    expect(result.hasSaving).toBe(false);
    expect(result.savingMinor).toBe(0);
    expect(result.savingPercentage).toBe(0);
    // The real difference is still available internally.
    expect(result.rawDifferenceMinor).toBe(-400);
  });

  it("treats an identical total as no saving", () => {
    const result = calculateSaving(7250, 7250);
    expect(result.hasSaving).toBe(false);
    expect(result.savingMinor).toBe(0);
  });

  it("persists fixed-precision values for numeric(10,2) and numeric(6,2)", () => {
    const persisted = toPersistableSaving(calculateSaving(8200, 6300));
    expect(persisted.saving_amount).toBe("19.00");
    expect(persisted.saving_percentage).toBe("23.17");
  });

  it("works from database decimal strings", () => {
    const result = calculateSavingFromStrings("67.50", "65.00");
    expect(result?.savingMinor).toBe(250);
    expect(result?.hasSaving).toBe(true);
  });

  it("avoids floating-point drift on values that break naive float maths", () => {
    // 0.1 + 0.2 style problem: 10.30 - 10.10 must be exactly 0.20.
    const result = calculateSaving(parseAmountToMinor("10.30")!, parseAmountToMinor("10.10")!);
    expect(result.savingMinor).toBe(20);
    expect(formatMinorAsCurrency(result.savingMinor)).toBe("AED 0.20");
  });
});

describe("bucketForSaving", () => {
  it("places savings in the validation buckets", () => {
    expect(bucketForSaving(0)).toBe("0-4.99");
    expect(bucketForSaving(499)).toBe("0-4.99");
    expect(bucketForSaving(500)).toBe("5-9.99");
    expect(bucketForSaving(999)).toBe("5-9.99");
    expect(bucketForSaving(1000)).toBe("10-19.99");
    expect(bucketForSaving(1999)).toBe("10-19.99");
    expect(bucketForSaving(2000)).toBe("20+");
    expect(bucketForSaving(99999)).toBe("20+");
  });
});
