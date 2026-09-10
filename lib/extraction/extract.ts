import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import {
  EXTRACTION_TIMEOUT_MS,
  MAX_CART_ITEMS,
  MAX_ITEM_NAME_LENGTH,
  MAX_ITEM_QUANTITY,
  MAX_RESTAURANT_NAME_LENGTH,
  MAX_TOTAL_AED,
} from "@/lib/constants";
import { getAnthropicApiKey, getExtractionModel } from "@/lib/env";
import { MoneyParseError, parseAmountToMinor } from "@/lib/calculations/money";
import { sanitiseText } from "@/lib/utils/text";
import type { ImageValidationSuccess } from "@/lib/validation/image";
import {
  modelExtractionSchema,
  type ExtractedItem,
  type ExtractionResult,
} from "./schema";

/**
 * Reads a cart screenshot with a vision model.
 *
 * This proposes; the customer disposes. Everything returned here is rendered
 * into editable fields on the confirm step, and it is the customer's confirmed
 * version that reaches the database - so a wrong read costs a correction, never
 * a wrong price. Nothing here is treated as authoritative, including the
 * quantities, which are re-validated against the same bounds a typed basket is.
 *
 * The image bytes leave our infrastructure at this point. That is disclosed on
 * /privacy; see README ("Reading the screenshot") before changing what is sent.
 */

const SYSTEM_PROMPT = `You read screenshots of food-delivery shopping carts and checkout screens from apps used in the UAE (Talabat, Careem Food, Deliveroo, Noon Food and similar) and report exactly what is printed on them.

Rules:
- Report only what is visibly printed. Never infer, complete or guess a name, a quantity or a price that is not on screen.
- linePrice is the price printed on that item's row, copied exactly. Do not divide it by the quantity and do not add anything to it. If the row shows no price, use "".
- Prices are plain decimal numbers with no currency symbol and no thousands separator, e.g. "64.00" or "8.5". Use "" when a value is not shown.
- Keep item names exactly as printed, in the script they are printed in. Arabic stays Arabic. Include the size or option shown on the row when it is part of the item's line.
- quantity is the number printed for that row. When no quantity is shown, use 1.
- restaurantName is the restaurant or store the cart belongs to. Use "" when the screenshot does not name it.
- orderTotal is the final total printed on the screenshot, if one is shown. Do not compute it yourself.
- Set readable to false when the image is not a food-delivery cart or checkout screen, or is too unclear to read. When readable is false, return an empty items array and empty strings.
- Ignore names, addresses, phone numbers, payment details and any other personal information on the screen. Do not report them anywhere in your answer.`;

const USER_PROMPT =
  "Read this food-delivery cart screenshot and report the restaurant, the items with their quantities and row prices, and the order total.";

/** Base64 without blowing the stack on a multi-megabyte screenshot. */
function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

/** A price the model reported, or null if it is missing or not sane. */
function priceToMinor(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;

  try {
    const minor = parseAmountToMinor(trimmed);
    if (minor === null || minor <= 0) return null;
    // A misread decimal point turns 8.50 into 850. Anything past the ceiling we
    // accept from a typed total is a misread, so drop the price and keep the item.
    if (minor > MAX_TOTAL_AED * 100) return null;
    return minor;
  } catch (error) {
    if (error instanceof MoneyParseError) return null;
    throw error;
  }
}

/** Applies the same bounds a typed basket gets, dropping anything unusable. */
function cleanItems(items: ModelItems): ExtractedItem[] {
  const cleaned: ExtractedItem[] = [];

  for (const item of items) {
    if (cleaned.length >= MAX_CART_ITEMS) break;

    const name = sanitiseText(item.name, MAX_ITEM_NAME_LENGTH);
    if (!name) continue;

    // A model that reports 0 or 500 of something has misread the row; clamp
    // rather than drop, because the item itself is almost certainly real.
    const quantity = Math.min(MAX_ITEM_QUANTITY, Math.max(1, Math.round(item.quantity)));

    cleaned.push({ name, quantity, linePriceMinor: priceToMinor(item.linePrice) });
  }

  return cleaned;
}

type ModelItems = Array<{ name: string; quantity: number; linePrice: string }>;

export type ExtractionOutcome =
  | { ok: true; result: ExtractionResult }
  | { ok: false; reason: "not_configured" | "failed" };

/**
 * Injectable for tests, which must never make a live call. Production passes
 * nothing and gets a real client.
 */
export interface ExtractionClient {
  parse: Anthropic["messages"]["parse"];
}

function createClient(apiKey: string): ExtractionClient {
  return new Anthropic({
    apiKey,
    timeout: EXTRACTION_TIMEOUT_MS,
    maxRetries: 1,
  }).messages;
}

export async function extractBasket(
  image: ImageValidationSuccess,
  client?: ExtractionClient,
): Promise<ExtractionOutcome> {
  const apiKey = getAnthropicApiKey();
  if (!client && !apiKey) return { ok: false, reason: "not_configured" };

  const messages = client ?? createClient(apiKey as string);

  try {
    const response = await messages.parse({
      model: getExtractionModel(),
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      // Reading a receipt needs no deliberation, and the customer is waiting.
      // Thinking stays on (adaptive) because disabling it on this model family
      // costs more than the low effort setting saves.
      output_config: {
        effort: "low",
        format: zodOutputFormat(modelExtractionSchema),
      },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: image.mimeType,
                data: toBase64(image.bytes),
              },
            },
            { type: "text", text: USER_PROMPT },
          ],
        },
      ],
    });

    // A safety decline, or a response the schema rejected, is a failed read -
    // not something to surface differently to the customer.
    if (response.stop_reason === "refusal") return { ok: false, reason: "failed" };

    const parsed = response.parsed_output;
    if (!parsed) return { ok: false, reason: "failed" };

    if (!parsed.readable) {
      return {
        ok: true,
        result: { restaurantName: null, items: [], orderTotalMinor: null, readable: false },
      };
    }

    return {
      ok: true,
      result: {
        restaurantName: sanitiseText(parsed.restaurantName, MAX_RESTAURANT_NAME_LENGTH),
        items: cleanItems(parsed.items),
        orderTotalMinor: priceToMinor(parsed.orderTotal),
        readable: true,
      },
    };
  } catch {
    // Timeouts, rate limits, outages. The customer types the basket instead,
    // which is exactly what they did before this feature existed.
    return { ok: false, reason: "failed" };
  }
}
