/**
 * Environment access.
 *
 * Public values are inlined by Next at build time; secrets are read lazily and
 * only ever from server code. Nothing here is exported to the browser bundle
 * except the two NEXT_PUBLIC_ values.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env.local and fill it in.`,
    );
  }
  return value;
}

export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "",
};

/**
 * An absolute link to somewhere on this site, for a message that leaves it.
 *
 * Null rather than a guess when NEXT_PUBLIC_APP_URL is unset: a result link
 * pointing at localhost in a WhatsApp message is worse than no link, and the
 * message reads fine without one.
 */
export function absoluteUrl(path: string): string | null {
  const base = publicEnv.appUrl.trim().replace(/\/+$/, "");
  if (!base) return null;
  try {
    return new URL(path, `${base}/`).toString();
  } catch {
    return null;
  }
}

export function getSupabaseUrl(): string {
  return required("NEXT_PUBLIC_SUPABASE_URL", publicEnv.supabaseUrl);
}

export function getSupabaseAnonKey(): string {
  return required("NEXT_PUBLIC_SUPABASE_ANON_KEY", publicEnv.supabaseAnonKey);
}

/** Server-only. Never import this from a client component. */
export function getServiceRoleKey(): string {
  return required("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * Screenshot reading. Absent key means the feature is simply off - the wizard
 * still works, the customer just types the basket themselves.
 */
export function getAnthropicApiKey(): string | null {
  return process.env.ANTHROPIC_API_KEY || null;
}

export function getExtractionModel(): string {
  return process.env.EXTRACTION_MODEL || "claude-opus-5";
}

export function isExtractionConfigured(): boolean {
  return getAnthropicApiKey() !== null;
}

export interface ResendConfig {
  apiKey: string;
  from: string;
}

/** Returns null when email is not configured - the app must still work. */
export function getResendConfig(): ResendConfig | null {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return null;
  return { apiKey, from };
}

export interface TelegramConfig {
  botToken: string;
  chatId: string;
}

/**
 * Telegram, for telling the admin a price check has come in.
 *
 * Chosen over email for the alert because the whole product depends on somebody
 * answering within minutes, and a phone buzzing is what makes that happen. It
 * also needs no account, no sender domain and no approval - a bot from
 * @BotFather and a chat id, both free.
 *
 * Null when unset, like everything else here: an unconfigured alert must leave
 * the customer's submission working exactly as it did.
 */
export function getTelegramConfig(): TelegramConfig | null {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) return null;
  return { botToken, chatId };
}

/** Where a "new price check" email goes, when email is the chosen alert. */
export function getAdminAlertEmail(): string | null {
  return process.env.ADMIN_ALERT_EMAIL?.trim() || null;
}
