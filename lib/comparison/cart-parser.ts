/**
 * Cart parsing abstraction.
 *
 * Future phases will send the cart screenshot to a vision model and get back the
 * restaurant, items, quantities and prices. Phase 1 does none of that: an admin
 * reads the screenshot. This interface reserves the seam, and the only
 * implementation reports that parsing is unavailable rather than inventing data.
 */

import type { BasketItem } from "./types";

export interface ParsedCart {
  restaurantName: string | null;
  items: BasketItem[];
  /** 0-1 confidence from an automated parser; always null when done by hand. */
  confidence: number | null;
}

export interface CartParseResult {
  supported: boolean;
  cart: ParsedCart | null;
  reason?: string;
}

export interface CartParserService {
  readonly id: string;
  parse(imagePath: string): Promise<CartParseResult>;
}

/** Phase 1: the "parser" is a human reading the screenshot in the dashboard. */
export class ManualCartParser implements CartParserService {
  readonly id = "manual";

  async parse(_imagePath: string): Promise<CartParseResult> {
    return {
      supported: false,
      cart: null,
      reason: "Cart screenshots are read manually in Phase 1. No automated parsing is configured.",
    };
  }
}

export const cartParser: CartParserService = new ManualCartParser();
