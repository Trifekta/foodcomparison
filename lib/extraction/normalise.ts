import {
  MAX_CART_ITEMS,
  MAX_ITEM_NAME_LENGTH,
  MAX_ITEM_QUANTITY,
  MAX_RESTAURANT_NAME_LENGTH,
  MAX_TOTAL_AED,
} from "@/lib/constants";
import { MoneyParseError, parseAmountToMinor, formatMinorToDecimalString } from "@/lib/calculations/money";
import { sanitiseText } from "@/lib/utils/text";
import type { StructuredBasket, StructuredItem } from "./schema";

/**
 * Cleans a model's output before anyone sees it.
 *
 * The schema guarantees the shape; it guarantees nothing about the values. This
 * applies the same bounds a typed basket gets, so that whatever reaches the
 * admin review screen is at least arithmetically sane. Anything it rejects is
 * blanked and flagged rather than dropped: a price the model misread is
 * information the admin needs, and silently removing it hides the error.
 */

const MAX_MODIFIERS = 12;
const MAX_UNCERTAIN = 60;

/** A money string the model produced, or "" if it cannot be one. */
function cleanMoney(raw: string): { value: string; rejected: boolean } {
  const trimmed = raw.trim().replace(/^AED\s*/i, "").replace(/,/g, "");
  if (trimmed === "") return { value: "", rejected: false };

  try {
    const minor = parseAmountToMinor(trimmed);
    if (minor === null || minor <= 0) return { value: "", rejected: true };
    // A misplaced decimal point turns 85.00 into 8500.00, past anything a Dubai
    // food order costs. Treat it as unreadable rather than pass it on.
    if (minor > MAX_TOTAL_AED * 100) return { value: "", rejected: true };
    return { value: formatMinorToDecimalString(minor), rejected: false };
  } catch (error) {
    if (error instanceof MoneyParseError) return { value: "", rejected: true };
    throw error;
  }
}

export function normaliseBasket(basket: StructuredBasket): StructuredBasket {
  const uncertain = new Set(
    basket.uncertain_fields
      .map((field) => sanitiseText(field, 120))
      .filter((field): field is string => field !== null),
  );

  /** Cleans one amount, flagging its path if the value had to be discarded. */
  const money = (raw: string, path: string): string => {
    const { value, rejected } = cleanMoney(raw);
    if (rejected) uncertain.add(path);
    return value;
  };

  const items: StructuredItem[] = [];

  for (const [index, item] of basket.items.entries()) {
    if (items.length >= MAX_CART_ITEMS) {
      uncertain.add("items");
      break;
    }

    const name = sanitiseText(item.name, MAX_ITEM_NAME_LENGTH);
    if (!name) continue;

    const position = items.length;

    // Out-of-range quantities are clamped, not dropped: the row is real even
    // when the number beside it was misread, and the admin is told to look.
    const rounded = Math.round(item.quantity);
    const quantity = Math.min(MAX_ITEM_QUANTITY, Math.max(1, Number.isFinite(rounded) ? rounded : 1));
    if (quantity !== item.quantity) uncertain.add(`items[${position}].quantity`);

    items.push({
      name,
      quantity,
      modifiers: item.modifiers
        .map((modifier) => sanitiseText(modifier, MAX_ITEM_NAME_LENGTH))
        .filter((modifier): modifier is string => modifier !== null)
        .slice(0, MAX_MODIFIERS),
      unit_price: money(item.unit_price, `items[${position}].unit_price`),
      line_total: money(item.line_total, `items[${position}].line_total`),
    });

    // Re-point any flag the model raised against the original index.
    if (position !== index) {
      for (const field of [...uncertain]) {
        if (field.startsWith(`items[${index}].`)) {
          uncertain.delete(field);
          uncertain.add(field.replace(`items[${index}].`, `items[${position}].`));
        }
      }
    }
  }

  return {
    restaurant_name: sanitiseText(basket.restaurant_name, MAX_RESTAURANT_NAME_LENGTH) ?? "",
    source_app: sanitiseText(basket.source_app, 80) ?? "",
    currency: sanitiseText(basket.currency, 8) ?? "AED",
    items,
    subtotal: money(basket.subtotal, "subtotal"),
    delivery_fee: money(basket.delivery_fee, "delivery_fee"),
    service_fee: money(basket.service_fee, "service_fee"),
    discount: money(basket.discount, "discount"),
    final_total: money(basket.final_total, "final_total"),
    uncertain_fields: [...uncertain].slice(0, MAX_UNCERTAIN),
  };
}
