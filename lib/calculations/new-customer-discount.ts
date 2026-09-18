/**
 * Keeta's new-customer discount, checked against the price the admin found.
 *
 * A single source of truth, same reasoning as saving.ts: read once here,
 * never re-implemented in the message builder or the result page.
 */

import { parseAmountToMinor } from "./money";
import { NEW_CUSTOMER_DISCOUNT_MIN_AED } from "@/lib/constants";

/**
 * "not_new" - they told us they already have a Keeta account, so the
 * question doesn't apply; nothing is said about it anywhere downstream.
 *
 * "eligible" and "below_minimum" are both said out loud, not just the good
 * news: a customer who answered yes and then hears nothing back has no way
 * to tell "you don't qualify" from "we forgot to check."
 */
export type NewCustomerDiscountStatus = "not_new" | "eligible" | "below_minimum";

/**
 * `comparisonTotal` is the price the admin found on Keeta, not what the
 * customer typed on step 3 - the discount is Keeta's own new-customer offer,
 * so the order that has to clear its minimum is the Keeta order, not the app
 * they are switching from.
 */
export function newCustomerDiscountStatus(
  newToKeeta: boolean,
  comparisonTotal: string,
): NewCustomerDiscountStatus {
  if (!newToKeeta) return "not_new";

  const minor = parseAmountToMinor(comparisonTotal);
  if (minor === null) return "not_new";

  const minimumMinor = NEW_CUSTOMER_DISCOUNT_MIN_AED * 100;
  return minor >= minimumMinor ? "eligible" : "below_minimum";
}
