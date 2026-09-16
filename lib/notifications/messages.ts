import { BRAND_NAME, COMPARISON_APP, LEGACY_OTHER_APP, UNKNOWN_SOURCE_APP } from "@/lib/constants";
import { calculateSaving } from "@/lib/calculations/saving";
import { formatMinorAsCurrency, parseAmountToMinor } from "@/lib/calculations/money";

/**
 * Customer result message templates.
 *
 * Wording is deliberately careful: prices move, so we say what we checked and
 * when, and never promise a guaranteed saving.
 */

/**
 * How the customer's own total is named in the message we send them.
 *
 * The customer is never asked which app they ordered from - the screenshot
 * shows it - so this has to read correctly when nobody has said. "Your order -
 * AED 34.65" does, which is what lets the question be dropped: an admin who
 * forgets to label a submission costs an analytics row, not a broken message.
 */
export function sourceAppLabel(source: {
  source_app: string;
  source_app_other?: string | null;
}): string {
  // "Other" was a customer choice once, and always came with a name beside it.
  // Without one it is not a label anybody would recognise in a message.
  if (source.source_app === LEGACY_OTHER_APP) return source.source_app_other || "Your order";
  if (!source.source_app || source.source_app === UNKNOWN_SOURCE_APP) return "Your order";
  return source.source_app;
}

/**
 * What we say when the checkout screenshot never arrived.
 *
 * Deliberately not "compared on the item subtotal", which would be a claim
 * about a number we never used: the baseline is whatever the customer typed
 * into the total field, and plenty of people type the real final total
 * straight off their own screen. What is actually missing is the means to
 * check it - fees and a discount are exactly what a cart screen does not show,
 * and they are where a typed total goes wrong.
 *
 * So the caveat is about verification, not arithmetic. Saying something
 * definite and wrong about somebody's own order is a worse outcome than not
 * warning them at all.
 *
 * One string, exported, because it is read in two places - the message we send
 * and the result page - and a caveat that is worded two ways is a caveat
 * nobody trusts.
 */
export const UNVERIFIED_TOTAL_NOTE =
  "We compared against the total you entered. Without your checkout screenshot we couldn't confirm the fees and discounts, so your actual saving may differ.";

export interface ResultMessageInput {
  sourceAppLabel: string;
  currentTotal: string;
  comparisonTotal: string;
  comparisonAppLabel?: string;
  /** Absolute link to the customer's own result page, when we can build one. */
  resultUrl?: string | null;
  /**
   * Whether a checkout screenshot was sent. Required rather than defaulted: a
   * caller that forgets it would quietly drop a caveat off a real customer's
   * message, and that is not a decision to make by omission.
   */
  checkoutScreenshotProvided: boolean;
}

export interface GeneratedResult {
  message: string;
  hasSaving: boolean;
  savingMinor: number;
  savingPercentage: number;
}

/**
 * The message for a basket nobody could price.
 *
 * Says what happened and stops. No apology dressed up as an offer, no
 * substitute restaurant: we promised this basket compared, and the honest
 * answer is that it cannot be. Naming the restaurant matters - it is the
 * difference between "we failed" and "this one is not on there yet".
 */
export function buildUnavailableMessage(input: {
  restaurantName: string | null;
  comparisonAppLabel?: string;
  resultUrl?: string | null;
}): string {
  const comparisonApp = input.comparisonAppLabel ?? COMPARISON_APP;
  const restaurant = input.restaurantName?.trim();

  return [
    restaurant
      ? `We checked, and we couldn't find ${restaurant} on ${comparisonApp}.`
      : `We checked, and we couldn't rebuild your order on ${comparisonApp}.`,
    "",
    `That means there's no ${comparisonApp} price to compare against this time, so go ahead and order where you were.`,
    ...(input.resultUrl ? ["", input.resultUrl] : []),
    "",
    "Send us another order any time — plenty of restaurants are on both.",
    "",
    `— ${BRAND_NAME}`,
  ].join("\n");
}

export function buildResultMessage(input: ResultMessageInput): GeneratedResult {
  const comparisonApp = input.comparisonAppLabel ?? COMPARISON_APP;
  const currentMinor = parseAmountToMinor(input.currentTotal);
  const comparisonMinor = parseAmountToMinor(input.comparisonTotal);

  if (currentMinor === null || comparisonMinor === null) {
    throw new Error("Both totals are required to generate a result message.");
  }

  const saving = calculateSaving(currentMinor, comparisonMinor);
  const currentLine = `${input.sourceAppLabel} — ${formatMinorAsCurrency(currentMinor)}`;
  const comparisonLine = `${comparisonApp} — ${formatMinorAsCurrency(comparisonMinor)}`;

  // The first line names us, because of where this message lands.
  //
  // It arrives on WhatsApp from a number the customer has never seen, and the
  // preview on their lock screen is the first line and nothing else. "Good news
  // - we found a cheaper option" from an unknown number reads like the opening
  // of a scam; the same sentence with SnipSavor in front of it reads like the
  // thing they asked for ten minutes ago. The sign-off stays, which is how a
  // business message is shaped either way.
  const message = saving.hasSaving
    ? [
        `${BRAND_NAME} — good news, we found a cheaper option for your order.`,
        "",
        "Your current total:",
        currentLine,
        "",
        "Alternative:",
        comparisonLine,
        "",
        "You could save:",
        formatMinorAsCurrency(saving.savingMinor),
        "",
        `That's about ${Math.round(saving.savingPercentage)}% less.`,
        ...(input.checkoutScreenshotProvided ? [] : ["", UNVERIFIED_TOTAL_NOTE]),
        ...(input.resultUrl ? ["", "See it and open the restaurant:", input.resultUrl] : []),
        "",
        "Prices and promotions can change, so please confirm the final amount in the delivery app before ordering.",
        "",
        `— ${BRAND_NAME}`,
      ].join("\n")
    : [
        `${BRAND_NAME} — we checked your order, but couldn't find a better price this time.`,
        "",
        "Your current total:",
        currentLine,
        "",
        `${comparisonApp} checked:`,
        formatMinorAsCurrency(comparisonMinor),
        "",
        "Your current option appears better right now.",
        ...(input.checkoutScreenshotProvided ? [] : ["", UNVERIFIED_TOTAL_NOTE]),
        "",
        "We'll keep working to help you catch the orders where switching actually makes sense.",
        "",
        `— ${BRAND_NAME}`,
      ].join("\n");

  return {
    message,
    hasSaving: saving.hasSaving,
    savingMinor: saving.savingMinor,
    savingPercentage: saving.savingPercentage,
  };
}

/** Short subject line for the email channel. */
export function buildResultSubject(hasSaving: boolean, reference: string): string {
  return hasSaving
    ? `You could save on your order (${reference})`
    : `We checked your order (${reference})`;
}

/**
 * wa.me deep link. The admin sends the message by hand in Phase 1 - there is no
 * WhatsApp Business API here, and opening the link is not treated as delivery.
 */
export function buildWhatsAppLink(phoneE164OrDigits: string, message: string): string {
  const digits = phoneE164OrDigits.replace(/[^\d]/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/** mailto: fallback so an admin can send from their own client. */
export function buildMailtoLink(email: string, subject: string, message: string): string {
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
}
