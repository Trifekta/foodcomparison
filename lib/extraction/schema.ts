import { z } from "zod";
import { MAX_CART_ITEMS, MAX_ITEM_NAME_LENGTH, MAX_ITEM_QUANTITY } from "@/lib/constants";

/**
 * What the vision model is asked to return, and what we let through afterwards.
 *
 * The model's schema is deliberately flat and all-required: an empty string
 * means "not visible in the screenshot" rather than an absent key, which keeps
 * the JSON schema simple and gives the model one obvious way to say "I can't
 * see this" instead of inventing a value.
 *
 * Prices are strings, never numbers. Money never touches binary floating point
 * in this codebase, and a model that returns 32.5 for "32.50" would otherwise
 * quietly become 32.5 fils-worth of rounding trouble.
 */

export const modelExtractionSchema = z.object({
  /** The restaurant as printed, or "" when the screenshot does not show it. */
  restaurantName: z.string(),
  items: z.array(
    z.object({
      /** The item as printed, including any size or option shown on the row. */
      name: z.string(),
      quantity: z.number().int(),
      /**
       * The price printed on that row, exactly as shown, e.g. "64.00".
       * Deliberately the row price and not a per-unit price: delivery apps
       * differ on which they display, and asking the model to divide invents
       * precision the screenshot does not have. "" when no price is shown.
       */
      linePrice: z.string(),
    }),
  ),
  /** The order total printed on the screenshot, or "". */
  orderTotal: z.string(),
  /** False when the image is not a food-delivery cart or is unreadable. */
  readable: z.boolean(),
});

export type ModelExtraction = z.infer<typeof modelExtractionSchema>;

/** One item after cleaning, as the wizard and the API exchange it. */
export interface ExtractedItem {
  name: string;
  quantity: number;
  /** Integer fils, or null when the screenshot showed no price. */
  linePriceMinor: number | null;
}

export interface ExtractionResult {
  restaurantName: string | null;
  items: ExtractedItem[];
  orderTotalMinor: number | null;
  readable: boolean;
}

/** The shape sent to the browser. Prices travel as fixed-2 decimal strings. */
export const extractionResponseSchema = z.object({
  restaurantName: z.string().max(200).nullable(),
  items: z
    .array(
      z.object({
        name: z.string().min(1).max(MAX_ITEM_NAME_LENGTH),
        quantity: z.number().int().min(1).max(MAX_ITEM_QUANTITY),
        linePrice: z.string().nullable(),
      }),
    )
    .max(MAX_CART_ITEMS),
  orderTotal: z.string().nullable(),
  readable: z.boolean(),
});

export type ExtractionResponse = z.infer<typeof extractionResponseSchema>;
