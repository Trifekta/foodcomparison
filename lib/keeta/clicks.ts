import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { VISIT_ID_PATTERN } from "@/lib/analytics/funnel";

/**
 * Writing down that somebody switched.
 *
 * The point of this table is evidence, so the numbers are copied in rather than
 * left to a join: they are what the customer had on the screen at the moment
 * they decided, and an admin correcting a total next week must not silently
 * rewrite last week's proof.
 *
 * Nothing here may cost the customer their redirect. Every failure is caught
 * and reported to the caller, which forwards them to Keeta regardless - a click
 * we failed to record is a number missing from a report; a customer stranded on
 * an error page is the product not working.
 */

/** Everything the report needs, gathered by the route before the write. */
export interface KeetaClickInput {
  submissionId: string;
  destinationUrl: string;
  visitId: string | null;
  restaurantName: string | null;
  sourceApp: string | null;
  areaId: string | null;
  areaName: string | null;
  currentTotal: string | null;
  comparisonTotal: string | null;
  savingAmount: string | null;
  savingPercentage: number | null;
  keetaCheaper: boolean | null;
  userAgent: string | null;
  referrer: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  /** The ad platform's click id the visit arrived with: fbclid, gclid, ttclid. */
  campaignId: string | null;
}

export interface RecordedClick {
  ok: boolean;
  clickRef: string;
  /** Why it was not written, for the log line. Never shown to a customer. */
  error?: string;
}

const CLICK_REF_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
const CLICK_REF_LENGTH = 10;

/**
 * KCLK_7Q2M9XBVTK.
 *
 * The same confusable-free alphabet the customer's reference number uses, for
 * the same reason: this is the identifier somebody reads down a phone to ask
 * "what happened to this one", and an O that might be a zero costs a minute
 * every time. The prefix makes it obvious what kind of thing it is when it
 * turns up in a spreadsheet beside a reference number.
 */
export function generateClickRef(): string {
  const bytes = new Uint8Array(CLICK_REF_LENGTH);
  crypto.getRandomValues(bytes);

  let out = "";
  for (const byte of bytes) {
    out += CLICK_REF_ALPHABET[byte % CLICK_REF_ALPHABET.length];
  }
  return `KCLK_${out}`;
}

/** Trims request metadata to something a column can hold and a person can read. */
function cap(value: string | null, max: number): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

/**
 * A visit id, or nothing.
 *
 * Shape-checked against the same pattern the funnel uses, because this value
 * arrives in a query string where anybody can write it. A wrong-shaped one is
 * dropped rather than stored: a report that counts "unique switchers" must not
 * be movable by typing into a URL.
 */
export function cleanVisitId(value: string | null | undefined): string | null {
  const candidate = (value ?? "").trim().toLowerCase();
  return VISIT_ID_PATTERN.test(candidate) ? candidate : null;
}

export async function recordKeetaClick(input: KeetaClickInput): Promise<RecordedClick> {
  const clickRef = generateClickRef();

  try {
    const { error } = await createAdminClient()
      .from("keeta_clicks")
      .insert({
        click_ref: clickRef,
        submission_id: input.submissionId,
        event: "switch_to_keeta_clicked",
        visit_id: input.visitId,
        restaurant_name: cap(input.restaurantName, 200),
        source_app: cap(input.sourceApp, 80),
        area_id: input.areaId,
        area_name: cap(input.areaName, 120),
        current_total: input.currentTotal,
        comparison_total: input.comparisonTotal,
        saving_amount: input.savingAmount,
        saving_percentage: input.savingPercentage,
        keeta_cheaper: input.keetaCheaper,
        destination_url: input.destinationUrl,
        // Request metadata that was already on the wire. Truncated because a
        // user agent is occasionally enormous and none of it is worth a row
        // that fails to insert.
        user_agent: cap(input.userAgent, 400),
        referrer: cap(input.referrer, 500),
        utm_source: cap(input.utmSource, 120),
        utm_medium: cap(input.utmMedium, 120),
        utm_campaign: cap(input.utmCampaign, 160),
        utm_content: cap(input.utmContent, 160),
        utm_term: cap(input.utmTerm, 160),
        campaign_id: cap(input.campaignId, 200),
        // Not 'clicked'. That would say we looked for an order and found none;
        // nothing has looked, and saying so is the difference between a click
        // and a sale.
        conversion_status: "unknown",
      });

    if (error) return { ok: false, clickRef, error: error.message };
    return { ok: true, clickRef };
  } catch (error) {
    return {
      ok: false,
      clickRef,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
