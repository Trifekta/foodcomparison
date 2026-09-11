import "server-only";

import { absoluteUrl, getAdminAlertEmail } from "@/lib/env";
import { getEmailProvider } from "./resend";
import { isTelegramConfigured, sendTelegramMessage } from "./telegram";
import { formatDecimalStringAsCurrency } from "@/lib/calculations/money";

/**
 * Telling the admin a price check has arrived.
 *
 * Without this the product does not work. Every comparison is done by a person,
 * and nobody sits refreshing a dashboard - so the minutes between a customer
 * uploading a screenshot and somebody looking at it are entirely decided by
 * whether a phone buzzed.
 *
 * Two channels, both optional and independent: Telegram if a bot is configured,
 * email if an address is. Configure neither and submissions carry on exactly as
 * before, which is the same rule every other integration here follows.
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
function compose(alert: NewSubmissionAlert): { subject: string; body: string } {
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

  return { subject: `New price check · ${alert.reference}`, body: lines.join("\n") };
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
  const { subject, body } = compose(alert);
  const jobs: Array<Promise<unknown>> = [];

  if (isTelegramConfigured()) jobs.push(sendTelegramMessage(body));

  const email = getAdminAlertEmail();
  if (email) {
    const provider = getEmailProvider();
    if (provider.configured) {
      jobs.push(provider.send({ to: email, subject, body, reference: alert.reference }));
    }
  }

  if (jobs.length === 0) return;
  await Promise.allSettled(jobs);
}

/** Which routes an alert would actually take right now. */
export function alertChannels(): string[] {
  const channels: string[] = [];
  if (isTelegramConfigured()) channels.push("Telegram");
  if (getAdminAlertEmail() && getEmailProvider().configured) channels.push("email");
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
    "Test alert from FindFoodae.",
    "",
    "If you can read this, a new price check will reach you the same way.",
    ...(link ? ["", link] : []),
  ].join("\n");

  const results: boolean[] = [];

  if (isTelegramConfigured()) results.push(await sendTelegramMessage(body));

  const email = getAdminAlertEmail();
  if (email) {
    const provider = getEmailProvider();
    if (provider.configured) {
      const outcome = await provider.send({
        to: email,
        subject: "Test alert from FindFoodae",
        body,
        reference: "test",
      });
      results.push(outcome.sent);
    }
  }

  return results.length > 0 && results.some(Boolean);
}
