/**
 * Notification provider abstraction.
 *
 * The MVP sends WhatsApp by hand, and email through Resend only if it is
 * configured. Everything goes through this interface so swapping in a different
 * provider (or adding the WhatsApp Business API later) is a one-file change.
 */

export interface NotificationPayload {
  to: string;
  subject: string;
  body: string;
  reference: string;
}

export type NotificationOutcome =
  | { sent: true; providerId: string; id?: string }
  | { sent: false; providerId: string; reason: string };

export interface NotificationProvider {
  readonly id: string;
  readonly configured: boolean;
  send(payload: NotificationPayload): Promise<NotificationOutcome>;
}

/**
 * Used when no email provider is configured. It does not pretend to send
 * anything - the admin UI falls back to "Copy email message".
 */
export class UnconfiguredEmailProvider implements NotificationProvider {
  readonly id = "unconfigured";
  readonly configured = false;

  async send(): Promise<NotificationOutcome> {
    return {
      sent: false,
      providerId: this.id,
      reason: "Email is not configured. Copy the message and send it manually.",
    };
  }
}
