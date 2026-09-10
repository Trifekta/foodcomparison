import { z } from "zod";

/**
 * The structured basket, and the schema the model is held to.
 *
 * Field names follow the agreed contract exactly. Money is the one deliberate
 * departure: every amount is a decimal STRING, never a JSON number. This
 * codebase does currency arithmetic in integer fils precisely so that money
 * never touches binary floating point, and a model emitting 32.5 for "32.50",
 * or 1e2 for "100.00", would smuggle a float back in at the one boundary we
 * cannot re-check. An empty string means "not present in the source".
 */

const money = z.string();

export const structuredItemSchema = z.object({
  name: z.string(),
  quantity: z.number().int(),
  /** Options printed under or beside the item: "Extra garlic", "No pickles". */
  modifiers: z.array(z.string()),
  /** Price for a single unit, if the source states one separately. */
  unit_price: money,
  /** Price printed against the row as a whole. */
  line_total: money,
});

export const structuredBasketSchema = z.object({
  restaurant_name: z.string(),
  /** Talabat, Careem Food, Deliveroo, Noon Food - or "" if not identifiable. */
  source_app: z.string(),
  currency: z.string(),
  items: z.array(structuredItemSchema),
  subtotal: money,
  delivery_fee: money,
  service_fee: money,
  discount: money,
  final_total: money,
  /**
   * Dot-paths the model is not confident about, e.g. "items[2].line_total" or
   * "restaurant_name". The admin UI highlights every field named here, so an
   * over-full list is cheap and an empty one where it should not be is not.
   */
  uncertain_fields: z.array(z.string()),
});

export type StructuredBasket = z.infer<typeof structuredBasketSchema>;
export type StructuredItem = z.infer<typeof structuredItemSchema>;

/** How the basket was produced. Stored, shown to the admin, and evaluated on. */
export type ExtractionMethod = "ocr_llm" | "vision";

export interface ExtractionRun {
  method: ExtractionMethod;
  basket: StructuredBasket;
  /** Verbatim OCR output. Null on the vision path, which never runs OCR. */
  ocrText: string | null;
  ocrConfidence: number | null;
  ocrEngine: string | null;
  ocrMs: number | null;
  model: string;
  promptVersion: string;
  llmMs: number;
}

export type ExtractionOutcome =
  | { ok: true; run: ExtractionRun }
  | { ok: false; reason: "not_configured" | "unreadable" | "failed"; detail?: string };

/** An empty basket, used when there is nothing to show but the shape is needed. */
export function emptyBasket(): StructuredBasket {
  return {
    restaurant_name: "",
    source_app: "",
    currency: "AED",
    items: [],
    subtotal: "",
    delivery_fee: "",
    service_fee: "",
    discount: "",
    final_total: "",
    uncertain_fields: [],
  };
}
