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

export interface ResultMessageInput {
  sourceAppLabel: string;
  currentTotal: string;
  comparisonTotal: string;
  comparisonAppLabel?: string;
}

export interface GeneratedResult {
  message: string;
  hasSaving: boolean;
  savingMinor: number;
  savingPercentage: number;
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

  const message = saving.hasSaving
    ? [
        "Good news — we found a cheaper option for your order.",
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
        "",
        "Prices and promotions can change, so please confirm the final amount in the delivery app before ordering.",
        "",
        `— ${BRAND_NAME}`,
      ].join("\n")
    : [
        "We checked your order, but we couldn't find a better price this time.",
        "",
        "Your current total:",
        currentLine,
        "",
        `${comparisonApp} checked:`,
        formatMinorAsCurrency(comparisonMinor),
        "",
        "Your current option appears better right now.",
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
