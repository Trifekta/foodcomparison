import { describe, expect, it } from "vitest";
import { computeValidationMetrics, type AnalyticsRow } from "@/lib/calculations/analytics";

function row(overrides: Partial<AnalyticsRow>): AnalyticsRow {
  return {
    status: "result_ready",
    source_app: "Talabat",
    current_total: "82.00",
    comparison_total: "63.00",
    saving_amount: "19.00",
    restaurant_name: "Al Safadi",
    unavailable_reason: null,
    areas: { name: "Al Karama" },
    ...overrides,
  };
}

describe("computeValidationMetrics", () => {
  it("returns zeroes for an empty dataset without dividing by zero", () => {
    const metrics = computeValidationMetrics([]);
    expect(metrics.totalSubmissions).toBe(0);
    expect(metrics.savingFoundPercentage).toBe(0);
    expect(metrics.noSavingPercentage).toBe(0);
    expect(metrics.averageSavingMinor).toBe(0);
  });

  it("counts a comparison as complete only once a competitor total exists", () => {
    const metrics = computeValidationMetrics([
      row({}),
      row({ comparison_total: null, saving_amount: null, status: "new" }),
    ]);

    expect(metrics.totalSubmissions).toBe(2);
    expect(metrics.completedComparisons).toBe(1);
  });

  it("defines saving_found as comparison_total < current_total", () => {
    const metrics = computeValidationMetrics([
      row({ current_total: "82.00", comparison_total: "63.00" }), // saving
      row({ current_total: "50.00", comparison_total: "54.00" }), // pricier
      row({ current_total: "40.00", comparison_total: "40.00" }), // identical
    ]);

    expect(metrics.completedComparisons).toBe(3);
    expect(metrics.savingFoundCount).toBe(1);
    expect(metrics.savingFoundPercentage).toBeCloseTo(33.33, 1);
    expect(metrics.noSavingPercentage).toBeCloseTo(66.67, 1);
  });

  it("averages only the comparisons where a saving was found", () => {
    const metrics = computeValidationMetrics([
      row({ current_total: "100.00", comparison_total: "80.00" }), // 20.00 / 20%
      row({ current_total: "100.00", comparison_total: "90.00" }), // 10.00 / 10%
      row({ current_total: "50.00", comparison_total: "60.00" }), // none
    ]);

    expect(metrics.savingFoundCount).toBe(2);
    expect(metrics.averageSavingMinor).toBe(1500);
    expect(metrics.averageSavingPercentage).toBeCloseTo(15, 5);
  });

  it("buckets savings for the distribution view", () => {
    const metrics = computeValidationMetrics([
      row({ current_total: "20.00", comparison_total: "17.00" }), // 3.00
      row({ current_total: "20.00", comparison_total: "13.00" }), // 7.00
      row({ current_total: "40.00", comparison_total: "25.00" }), // 15.00
      row({ current_total: "80.00", comparison_total: "50.00" }), // 30.00
    ]);

    const counts = Object.fromEntries(
      metrics.savingDistribution.map((bucket) => [bucket.key, bucket.count]),
    );
    expect(counts["0-4.99"]).toBe(1);
    expect(counts["5-9.99"]).toBe(1);
    expect(counts["10-19.99"]).toBe(1);
    expect(counts["20+"]).toBe(1);
  });

  it("breaks submissions down by area and source app, busiest first", () => {
    const metrics = computeValidationMetrics([
      row({ areas: { name: "Al Karama" }, source_app: "Talabat" }),
      row({ areas: { name: "Al Karama" }, source_app: "Deliveroo" }),
      row({ areas: { name: "Dubai Marina" }, source_app: "Talabat" }),
      row({ areas: null, source_app: "Talabat" }),
    ]);

    expect(metrics.byArea[0]).toEqual({ label: "Al Karama", count: 2 });
    expect(metrics.byArea.map((entry) => entry.label)).toContain("Unknown area");
    expect(metrics.bySourceApp[0]).toEqual({ label: "Talabat", count: 3 });
  });
});

describe("baskets nobody could price", () => {
  it("counts them, and keeps them out of the saving maths", () => {
    // These have no comparison total by definition, so they must not drag the
    // "found a saving" rate down as if we had checked and failed to beat it.
    const metrics = computeValidationMetrics([
      row({}),
      row({ status: "unavailable", comparison_total: null, saving_amount: null }),
    ]);

    expect(metrics.totalSubmissions).toBe(2);
    expect(metrics.completedComparisons).toBe(1);
    expect(metrics.savingFoundCount).toBe(1);
    expect(metrics.savingFoundPercentage).toBe(100);
    expect(metrics.unavailableCount).toBe(1);
    expect(metrics.unavailablePercentage).toBe(50);
  });

  it("separates a missing restaurant from a menu that would not match", () => {
    const metrics = computeValidationMetrics([
      row({ status: "unavailable", comparison_total: null, unavailable_reason: "restaurant_not_listed" }),
      row({ status: "unavailable", comparison_total: null, unavailable_reason: "items_not_available" }),
      row({ status: "unavailable", comparison_total: null, unavailable_reason: "restaurant_not_listed" }),
    ]);

    expect(metrics.unavailableByReason).toEqual([
      { label: "Restaurant not listed", count: 2 },
      { label: "Items not available", count: 1 },
    ]);
  });

  it("names the restaurants, which is the actionable half", () => {
    const metrics = computeValidationMetrics([
      row({ status: "unavailable", comparison_total: null, restaurant_name: "Mandarin Oak" }),
      row({ status: "unavailable", comparison_total: null, restaurant_name: "Mandarin Oak" }),
      row({ status: "unavailable", comparison_total: null, restaurant_name: "ALBAIK" }),
    ]);

    expect(metrics.unavailableRestaurants).toEqual([
      { label: "Mandarin Oak", count: 2 },
      { label: "ALBAIK", count: 1 },
    ]);
  });

  it("says so rather than guessing when the reason was never recorded", () => {
    const metrics = computeValidationMetrics([
      row({ status: "unavailable", comparison_total: null, unavailable_reason: null }),
    ]);
    expect(metrics.unavailableByReason).toEqual([{ label: "Not recorded", count: 1 }]);
  });
});
