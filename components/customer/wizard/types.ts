import type { CartItem, SubmissionFields } from "@/lib/validation/submission";

/** Text values held by react-hook-form. Files and items live in component state. */
export type WizardValues = SubmissionFields;

export interface WizardFiles {
  cart: File | null;
  checkout: File | null;
}

/** What a row originally was when the model proposed it, for comparison later. */
export interface ProposedItem {
  name: string;
  quantity: number;
  linePrice: string | null;
}

/**
 * A row in the item list, as it is being edited.
 *
 * `quantity` is a number because the stepper is the only way to change it, so
 * it can never hold a half-typed value; `name` is free text and a blank row is
 * simply one nobody has filled in. `key` is a stable React key that survives
 * reordering and deletion - the name is not unique enough for that.
 *
 * `proposed` is unused on the customer path, which is entirely typed, and is
 * kept because the source labelling below is shared with the admin extraction
 * flow, where a row genuinely can start as a machine suggestion.
 */
export interface CartItemDraft {
  key: string;
  name: string;
  quantity: number;
  /** Fixed-2 decimal string, or null when no price was read for this row. */
  linePrice: string | null;
  /**
   * The read flagged this price as not trustworthy - usually a currency glyph
   * OCR welded onto the number, turning 39.00 into 539.00. Only ever set where
   * there is evidence, so it stays a signal rather than decoration.
   */
  priceUncertain?: boolean;
  proposed: ProposedItem | null;
}

/** How the free screenshot read is going, as far as the wizard is concerned. */
export type ExtractionStatus = "idle" | "reading" | "applied" | "empty";

/** Totals read off the screenshot, shown back so the customer can check them. */
export interface ReadTotals {
  subtotal: string;
  deliveryFee: string;
  serviceFee: string;
  discount: string;
  finalTotal: string;
}

/**
 * Four screens: upload, confirm the basket, where and how much, then review.
 *
 * Review is a step rather than an epilogue because it is where the customer
 * says how to reach them - the last screen does real work, so it gets a real
 * number on the progress bar.
 */
export const TOTAL_STEPS = 4;

export const WIZARD_DEFAULTS: WizardValues = {
  restaurantName: "",
  areaId: "",
  currentTotal: "",
  dialCode: "+971",
  whatsappNumber: "",
  marketingConsent: false,
};

/** Rows the customer left blank are dropped; the list is optional. */
export function usableItems(items: CartItemDraft[]): CartItem[] {
  return items.flatMap((item) => {
    const name = item.name.trim();
    if (!name) return [];

    const unchanged =
      item.proposed !== null &&
      item.proposed.name === item.name &&
      item.proposed.quantity === item.quantity &&
      item.proposed.linePrice === item.linePrice;

    return [
      {
        name,
        quantity: item.quantity,
        linePrice: item.linePrice,
        source: item.proposed === null ? "customer" : unchanged ? "extracted" : "edited",
      } as CartItem,
    ];
  });
}

/** Which screenshot a read belongs to. Both are read; each is believed about
 *  a different thing - the cart for what was ordered, the payment screen for
 *  what it came to. */
export type ReadSlot = "cart" | "checkout";

/** True when a read found at least one figure worth showing. */
export function hasAnyTotal(totals: ReadTotals | null): totals is ReadTotals {
  return totals !== null && Object.values(totals).some((value) => value !== "");
}

/**
 * One set of figures out of two screenshots.
 *
 * The cart screen lists what was ordered, but the payment screen is where the
 * money is actually settled: fees added, discount applied, delivery counted.
 * So wherever the payment screen was read, it wins - field by field, because
 * OCR routinely loses one line and not the next, and a figure the cart screen
 * did read is better than a blank row.
 */
export function mergeReadTotals(
  cart: ReadTotals | null,
  checkout: ReadTotals | null,
): ReadTotals | null {
  if (!hasAnyTotal(checkout)) return cart;
  if (!cart) return checkout;

  const pick = (from: keyof ReadTotals) => (checkout[from] !== "" ? checkout[from] : cart[from]);

  return {
    subtotal: pick("subtotal"),
    deliveryFee: pick("deliveryFee"),
    serviceFee: pick("serviceFee"),
    discount: pick("discount"),
    finalTotal: pick("finalTotal"),
  };
}

/**
 * One banner out of two reads.
 *
 * Still reading anything means still reading: the totals on screen may yet
 * change, and saying so is more honest than showing a settled result that is
 * about to move. Otherwise anything found beats nothing found.
 */
export function combineStatus(
  cart: ExtractionStatus,
  checkout: ExtractionStatus,
): ExtractionStatus {
  const both = [cart, checkout];
  if (both.includes("reading")) return "reading";
  if (both.includes("applied")) return "applied";
  if (both.includes("empty")) return "empty";
  return "idle";
}

/**
 * Whether the screenshots settled the bill, or only listed the food.
 *
 * The question the caveat on a result actually turns on, and it is not "how
 * many screenshots did they send". Talabat, noon and Keeta print the whole
 * payment summary - discount, delivery, service fee, total - on the cart page,
 * so one screenshot from any of them answers everything; Deliveroo splits it
 * across two screens, and is the only one of the four that needs both slots.
 *
 * Two conditions, together. A final total, which the extraction prompt is
 * forbidden to derive - it may only copy what is printed - so a non-empty value
 * is evidence the number was on the screen. And at least one fee or discount
 * line beside it, because that is what separates a payment summary from an item
 * list with a subtotal at the bottom, and the fees are precisely what the
 * caveat says we could not check.
 */
export function totalsAreSettled(totals: ReadTotals | null): boolean {
  if (!totals || !totals.finalTotal) return false;
  return totals.deliveryFee !== "" || totals.serviceFee !== "" || totals.discount !== "";
}

/**
 * Whether the second upload slot should stop hedging and say so.
 *
 * Pulled out of the JSX that reads it for the same reason shouldAutofillTotal
 * was: it is a decision, not a rendering detail, and a decision is worth
 * pinning down with a test rather than eyeballed on a screen.
 *
 * True only once the cart screenshot has been read in full and it did not
 * carry a settled bill - an item list with no payment summary under it, the
 * Deliveroo shape. Before that read finishes, or once it has confirmed the
 * bill is already settled, there is nothing to escalate: either the question
 * is still open, or it is already answered the good way.
 */
export function cartConfirmedShort(input: {
  /** Whether a cart screenshot has been chosen at all. */
  hasCartFile: boolean;
  /** The cart screenshot is still being read. */
  cartReading: boolean;
  /** What that read came back with, once it is done. */
  cartSettled: boolean;
}): boolean {
  if (!input.hasCartFile || input.cartReading) return false;
  return !input.cartSettled;
}

/**
 * Whether to put the total read off a screenshot into the field for them.
 *
 * Pulled out of the effect that calls it so the one rule with a decision in it
 * can be tested: an effect needs a browser, and this needs to be right. The
 * caller keeps the memory - what it last filled in - and passes it back.
 */
export function shouldAutofillTotal(input: {
  /** The final total read off either screenshot, "" when there was none. */
  readFinalTotal: string;
  /** What is in the field now. */
  typed: string;
  /** What this filled in last time, if anything. */
  lastAutofilled: string | null;
}): boolean {
  if (!input.readFinalTotal) return false;
  // Already done, and not undone by them.
  if (input.lastAutofilled === input.readFinalTotal) return false;
  // Their own reading of their own screen beats ours. Only an empty field, or
  // one still holding a number we put there, may be written over.
  if (input.typed && input.typed !== input.lastAutofilled) return false;
  return true;
}
