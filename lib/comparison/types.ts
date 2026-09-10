/**
 * Comparison provider abstraction.
 *
 * Phase 1 is deliberately manual: an admin opens Keeta, rebuilds the basket and
 * types the total. This interface exists so a real integration (Keeta API, or
 * another platform) can be dropped in later without touching the UI or the
 * savings maths. No implementation here calls an external service.
 */

export interface ComparisonLocation {
  areaId: string;
  areaName: string;
  latitude?: number | null;
  longitude?: number | null;
}

export interface ComparisonRestaurant {
  id: string;
  name: string;
}

export interface BasketItem {
  name: string;
  quantity: number;
  unitPriceMinor?: number;
}

export interface BasketEstimate {
  /** Total in fils, including fees and promotions where the provider knows them. */
  totalMinor: number;
  /** Where the number came from - "manual" for the Phase 1 provider. */
  source: "manual" | "api";
  capturedAt: string;
  notes?: string;
}

export interface DeliveryComparisonProvider {
  readonly id: string;
  readonly displayName: string;
  /** False for manual providers: the UI shows an input instead of a fetch button. */
  readonly automated: boolean;

  findRestaurants(location: ComparisonLocation): Promise<ComparisonRestaurant[]>;
  getRestaurantMenu(restaurant: ComparisonRestaurant): Promise<BasketItem[]>;
  calculateBasket(items: BasketItem[], location: ComparisonLocation): Promise<BasketEstimate>;
  getPromotions(location: ComparisonLocation): Promise<string[]>;
  getDeliveryFeeMinor(location: ComparisonLocation): Promise<number | null>;
  getFinalEstimate(items: BasketItem[], location: ComparisonLocation): Promise<BasketEstimate | null>;
}

export class ManualComparisonRequired extends Error {
  constructor(providerName: string) {
    super(
      `${providerName} is compared manually in Phase 1. An admin enters the total in the dashboard.`,
    );
    this.name = "ManualComparisonRequired";
  }
}
