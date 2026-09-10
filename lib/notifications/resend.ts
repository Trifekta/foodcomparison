import "server-only";

import { getResendConfig } from "@/lib/env";
import {
  UnconfiguredEmailProvider,
  type NotificationOutcome,
  type NotificationPayload,
  type NotificationProvider,
} from "./provider";

/**
 * Resend-backed email provider.
 *
 * The SDK is imported lazily so the app builds and runs unchanged when RESEND_API_KEY
 * is absent - a missing email configuration must never break the product.
 */
class ResendEmailProvider implements NotificationProvider {
  readonly id = "resend";
  readonly configured = true;

  constructor(private readonly apiKey: string, private readonly from: string) {}

  async send(payload: NotificationPayload): Promise<NotificationOutcome> {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: this.from,
          to: [payload.to],
          subject: payload.subject,
          text: payload.body,
        }),
      });

      if (!response.ok) {
        return {
          sent: false,
          providerId: this.id,
          reason: `Email provider returned ${response.status}.`,
        };
      }

      const data = (await response.json()) as { id?: string };
      return { sent: true, providerId: this.id, id: data.id };
    } catch {
      // Deliberately no payload in the log line: it contains customer data.
      return { sent: false, providerId: this.id, reason: "Email provider request failed." };
    }
  }
}

export function getEmailProvider(): NotificationProvider {
  const config = getResendConfig();
  if (!config) return new UnconfiguredEmailProvider();
  return new ResendEmailProvider(config.apiKey, config.from);
}

export function isEmailConfigured(): boolean {
  return getResendConfig() !== null;
}
