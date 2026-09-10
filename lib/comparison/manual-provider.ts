import { COMPARISON_APP } from "@/lib/constants";
import {
  ManualComparisonRequired,
  type BasketEstimate,
  type BasketItem,
  type ComparisonLocation,
  type ComparisonRestaurant,
  type DeliveryComparisonProvider,
} from "./types";

/**
 * The only provider that exists in Phase 1.
 *
 * It performs no network access of any kind. Every lookup method throws
 * ManualComparisonRequired so that a future caller cannot mistake this for a
 * working integration, and `recordManualEstimate` is the one supported path.
 */
export class ManualComparisonProvider implements DeliveryComparisonProvider {
  readonly id = "manual";
  readonly displayName = COMPARISON_APP;
  readonly automated = false;

  async findRestaurants(_location: ComparisonLocation): Promise<ComparisonRestaurant[]> {
    throw new ManualComparisonRequired(this.displayName);
  }

  async getRestaurantMenu(_restaurant: ComparisonRestaurant): Promise<BasketItem[]> {
    throw new ManualComparisonRequired(this.displayName);
  }

  async calculateBasket(
    _items: BasketItem[],
    _location: ComparisonLocation,
  ): Promise<BasketEstimate> {
    throw new ManualComparisonRequired(this.displayName);
  }

  async getPromotions(_location: ComparisonLocation): Promise<string[]> {
    throw new ManualComparisonRequired(this.displayName);
  }

  async getDeliveryFeeMinor(_location: ComparisonLocation): Promise<number | null> {
    throw new ManualComparisonRequired(this.displayName);
  }

  /** Returns null: there is nothing to estimate automatically yet. */
  async getFinalEstimate(): Promise<BasketEstimate | null> {
    return null;
  }

  /** The supported Phase 1 path: an admin typed this number after checking Keeta. */
  recordManualEstimate(totalMinor: number, notes?: string): BasketEstimate {
    return {
      totalMinor,
      source: "manual",
      capturedAt: new Date().toISOString(),
      notes,
    };
  }
}

export const comparisonProvider = new ManualComparisonProvider();
