import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { isValidResultToken } from "@/lib/utils/reference";
import { calculateSavingFromStrings } from "@/lib/calculations/saving";
import { formatMinorToDecimalString, parseAmountToMinor } from "@/lib/calculations/money";
import type { SubmissionItemRow, SubmissionStatus } from "@/types/database";

/**
 * The customer's view of their own submission.
 *
 * Read with the service role and projected down to these fields before it ever
 * reaches the browser, exactly as the area list is. The submissions table holds
 * the admin's notes, the internal test-location label, the customer's own phone
 * number and the storage paths of their screenshots; none of that belongs on a
 * page whose only key is a link somebody might forward.
 *
 * The token is the whole of the authorisation. That is deliberate and it is why
 * it is 128 bits rather than the reference number: possession of the link is
 * possession of the result, so the link must not be guessable and the page must
 * carry nothing that would hurt if it were forwarded.
 */

/** What the customer is shown, and nothing else. */
export interface PublicResult {
  referenceNumber: string;
  /** Where the request has got to, collapsed to the three states worth showing. */
  state: "checking" | "saving" | "no_saving" | "cancelled";
  restaurantName: string | null;
  /** The total the customer told us they would pay. */
  currentTotal: string;
  comparisonApp: string;
  /** Null until an admin has rebuilt the basket and saved a total. */
  comparisonTotal: string | null;
  savingAmount: string | null;
  savingPercentage: number | null;
  /** The restaurant's page on the comparison app, when an admin has linked it. */
  comparisonUrl: string | null;
  items: Array<{ name: string; quantity: number; linePrice: string | null }>;
  createdAt: string;
}

/**
 * Which statuses count as an answer.
 *
 * 'comparison_found' and 'result_ready' both mean the admin has saved a total;
 * 'result_sent' means they also messaged it. All three are the same thing to
 * the customer - the answer is in - so the page shows it as soon as it exists
 * rather than waiting for someone to press send.
 */
const ANSWERED: readonly SubmissionStatus[] = [
  "comparison_found",
  "result_ready",
  "result_sent",
] as const;

function stateOf(status: SubmissionStatus, hasSaving: boolean): PublicResult["state"] {
  if (status === "cancelled") return "cancelled";
  if (status === "no_saving") return "no_saving";
  if (ANSWERED.includes(status)) return hasSaving ? "saving" : "no_saving";
  return "checking";
}

export async function getPublicResult(token: string): Promise<PublicResult | null> {
  // Shape-checked before the query so a malformed token is never a round trip.
  if (!isValidResultToken(token)) return null;

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("submissions")
    .select(
      "id, reference_number, status, restaurant_name, current_total, comparison_app, comparison_total, saving_amount, saving_percentage, comparison_url, created_at",
    )
    .eq("result_token", token)
    .maybeSingle();

  if (error || !data) return null;

  const saving =
    data.comparison_total !== null
      ? calculateSavingFromStrings(data.current_total, data.comparison_total)
      : null;

  const state = stateOf(data.status, saving?.hasSaving ?? false);

  // Items are only worth fetching once there is a result to rebuild.
  let items: PublicResult["items"] = [];
  if (state === "saving") {
    const { data: rows } = await supabase
      .from("submission_items")
      .select("name, quantity, line_price_minor")
      .eq("submission_id", data.id)
      .order("sort_order", { ascending: true });

    items = ((rows ?? []) as Pick<SubmissionItemRow, "name" | "quantity" | "line_price_minor">[]).map(
      (row) => ({
        name: row.name,
        quantity: row.quantity,
        linePrice:
          row.line_price_minor !== null ? formatMinorToDecimalString(row.line_price_minor) : null,
      }),
    );
  }

  return {
    referenceNumber: data.reference_number,
    state,
    restaurantName: data.restaurant_name,
    currentTotal: data.current_total,
    comparisonApp: data.comparison_app,
    comparisonTotal: state === "checking" ? null : data.comparison_total,
    savingAmount:
      saving && saving.hasSaving ? formatMinorToDecimalString(saving.savingMinor) : null,
    savingPercentage: saving && saving.hasSaving ? Math.round(saving.savingPercentage) : null,
    comparisonUrl: state === "saving" ? sanitiseLink(data.comparison_url) : null,
    items,
    createdAt: data.created_at,
  };
}

/**
 * Only an https link ever reaches the customer's browser.
 *
 * The value is typed by an admin, so this is not a trust boundary so much as a
 * seatbelt: a mistyped or pasted-wrong value should produce no button, never a
 * javascript: URL on a page we hand to a customer.
 */
function sanitiseLink(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Exported for the admin form, which rejects a bad link before storing it. */
export function isStorableComparisonUrl(value: string): boolean {
  return sanitiseLink(value) !== null;
}

/** Kept alongside the parse so both sides agree on what a total looks like. */
export function totalAsMinor(value: string): number {
  return parseAmountToMinor(value) ?? 0;
}
