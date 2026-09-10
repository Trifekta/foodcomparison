import { describe, expect, it } from "vitest";
import { ManualComparisonProvider } from "@/lib/comparison/manual-provider";
import { ManualComparisonRequired } from "@/lib/comparison/types";
import { ManualCartParser } from "@/lib/comparison/cart-parser";

/**
 * Phase 1 must contain no fake integrations. These tests pin that: the manual
 * provider refuses to pretend it can look anything up, and the cart parser
 * reports that it is unsupported rather than inventing items.
 */

const location = { areaId: "area-1", areaName: "Al Karama" };

describe("ManualComparisonProvider", () => {
  const provider = new ManualComparisonProvider();

  it("declares itself manual", () => {
    expect(provider.automated).toBe(false);
    expect(provider.displayName).toBe("Keeta");
  });

  it("refuses every automated lookup instead of returning invented data", async () => {
    await expect(provider.findRestaurants(location)).rejects.toBeInstanceOf(ManualComparisonRequired);
    await expect(provider.getRestaurantMenu({ id: "r", name: "R" })).rejects.toBeInstanceOf(
      ManualComparisonRequired,
    );
    await expect(provider.calculateBasket([], location)).rejects.toBeInstanceOf(
      ManualComparisonRequired,
    );
    await expect(provider.getPromotions(location)).rejects.toBeInstanceOf(ManualComparisonRequired);
    await expect(provider.getDeliveryFeeMinor(location)).rejects.toBeInstanceOf(
      ManualComparisonRequired,
    );
  });

  it("returns no automatic estimate", async () => {
    expect(await provider.getFinalEstimate()).toBeNull();
  });

  it("records a total an admin actually typed", () => {
    const estimate = provider.recordManualEstimate(6300, "Karama Test 01");
    expect(estimate.totalMinor).toBe(6300);
    expect(estimate.source).toBe("manual");
    expect(estimate.notes).toBe("Karama Test 01");
  });
});

describe("ManualCartParser", () => {
  it("reports that automated parsing is unavailable and returns no cart", async () => {
    const result = await new ManualCartParser().parse("submissions/abc/cart.png");

    expect(result.supported).toBe(false);
    expect(result.cart).toBeNull();
    expect(result.reason).toContain("manually");
  });
});
