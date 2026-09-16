import "server-only";

import { absoluteUrl } from "@/lib/env";
import { isTelegramConfigured, sendTelegramMessage } from "./telegram";
import { formatDecimalStringAsCurrency } from "@/lib/calculations/money";
import { BRAND_NAME } from "@/lib/constants";

/**
 * Telling the admin a price check has arrived.
 *
 * Without this the product does not work. Every comparison is done by a person,
 * and nobody sits refreshing a dashboard - so the minutes between a customer
 * uploading a screenshot and somebody looking at it are entirely decided by
 * whether a phone buzzed.
 *
 * Telegram, if a bot token is set, alongside the browser push that does the
 * real work. Optional, like every integration here: configure nothing and
 * submissions carry on exactly as before.
 */

export interface NewSubmissionAlert {
  reference: string;
  restaurantName: string | null;
  areaName: string | null;
  currentTotal: string;
  hasCheckoutImage: boolean;
  itemCount: number;
}

/**
 * What the alert may say.
 *
 * No phone number, no email address, no screenshot - those live behind the
 * admin login and stay there. What is here is what decides whether it is worth
 * getting up for: which restaurant, where, how much, and the link to work on.
 */
function compose(alert: NewSubmissionAlert): string {
  const total = formatDecimalStringAsCurrency(alert.currentTotal) ?? alert.currentTotal;
  const link = absoluteUrl("/admin");

  const lines = [
    `New price check · ${alert.reference}`,
    "",
    `Restaurant: ${alert.restaurantName?.trim() || "not given"}`,
    `Area: ${alert.areaName?.trim() || "not given"}`,
    `Customer total: ${total}`,
    `Screenshots: ${alert.hasCheckoutImage ? "cart + checkout" : "cart only"}`,
    ...(alert.itemCount > 0 ? [`Items listed: ${alert.itemCount}`] : []),
    ...(link ? ["", link] : []),
  ];

  // Body only: the subject line existed for the email channel, which is gone.
  return lines.join("\n");
}

/**
 * Fire and forget, but awaited.
 *
 * Awaited rather than left running because a Worker stops executing once it has
 * responded, and an alert that races the response is one that sometimes never
 * sends. The cost is a few hundred milliseconds on a submission that already
 * spent seconds uploading images, and every path swallows its own failure - a
 * missed alert must never cost a customer their submission.
 */
export async function alertAdminOfNewSubmission(alert: NewSubmissionAlert): Promise<void> {
  const body = compose(alert);
  const jobs: Array<Promise<unknown>> = [];

  if (isTelegramConfigured()) jobs.push(sendTelegramMessage(body));


  if (jobs.length === 0) return;
  await Promise.allSettled(jobs);
}

/** Which routes an alert would actually take right now. */
export function alertChannels(): string[] {
  const channels: string[] = [];
  if (isTelegramConfigured()) channels.push("Telegram");
  return channels;
}

/**
 * A real alert down the real channels, saying plainly that it is a test.
 *
 * Deliberately the same code path as a genuine one - a test that proved a
 * different path worked would be worth nothing.
 */
export async function sendTestAdminAlert(): Promise<boolean> {
  const link = absoluteUrl("/admin");
  const body = [
    `Test alert from ${BRAND_NAME}.`,
    "",
    "If you can read this, a new price check will reach you the same way.",
    ...(link ? ["", link] : []),
  ].join("\n");

  const results: boolean[] = [];

  if (isTelegramConfigured()) results.push(await sendTelegramMessage(body));


  return results.length > 0 && results.some(Boolean);
}
