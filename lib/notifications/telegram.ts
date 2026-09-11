import "server-only";

import { getTelegramConfig } from "@/lib/env";

/**
 * A message to the admin's phone.
 *
 * Telegram rather than email because the product only works if somebody
 * answers within minutes, and email does not reliably buzz. One HTTPS call, no
 * SDK, no sender domain to verify - which also means it runs unchanged on a
 * Worker.
 *
 * Whatever is passed here reaches a third party, so callers must keep the
 * customer out of it: a reference, a restaurant and an amount are fine, a
 * phone number is not.
 */
export async function sendTelegramMessage(text: string): Promise<boolean> {
  const config = getTelegramConfig();
  if (!config) return false;

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${config.botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: config.chatId,
          text,
          // Links in the message should not expand into a preview card - the
          // admin dashboard is behind a login and the preview is just noise.
          disable_web_page_preview: true,
        }),
        signal: AbortSignal.timeout(4000),
      },
    );
    return response.ok;
  } catch {
    // Never logged with the payload, and never fatal: a missed alert is a
    // slower answer, while a thrown error here would cost the submission.
    return false;
  }
}

export function isTelegramConfigured(): boolean {
  return getTelegramConfig() !== null;
}
