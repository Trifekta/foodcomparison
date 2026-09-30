/**
 * Environment access.
 *
 * Public values are inlined by Next at build time; secrets are read lazily and
 * only ever from server code. Nothing here is exported to the browser bundle
 * except the two NEXT_PUBLIC_ values.
 */

import { isValidVersion, type MinimumVersions } from "@/lib/api/v1/client";
import environments from "@/deploy/environments.json";
import { checkStagingValues } from "@/lib/deploy/staging-isolation.mjs";

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
  assertStagingIsolation();
  return required("NEXT_PUBLIC_SUPABASE_URL", publicEnv.supabaseUrl);
}

/**
 * Which deployment this Worker says it is. Only the staging Worker sets
 * SNIPSAVOR_ENV (wrangler.jsonc, env.staging.vars); production leaves it unset,
 * and everything below is then a no-op.
 */
export function isStagingDeployment(): boolean {
  return process.env.SNIPSAVOR_ENV?.trim().toLowerCase() === "staging";
}

let stagingIsolationConfirmed = false;

/**
 * On the staging Worker, refuse to reach any Supabase that is not staging's.
 *
 * The staging build already checks this (scripts/build-staging.mjs), but a
 * bundle can reach the staging Worker without that script - a local
 * `npm run cf:build` followed by `wrangler deploy --env staging`, say, which
 * would bake in whatever .env.local held. The Worker then knows it is staging
 * (SNIPSAVOR_ENV comes from wrangler.jsonc, not from the build) and compares
 * the Supabase URL, keys and app URL it was given against
 * deploy/environments.json. Every client is made through getSupabaseUrl(), so
 * failing here means no query, upload or sign-in leaves the Worker - the site
 * stops working rather than writing to production.
 */
function assertStagingIsolation(): void {
  if (stagingIsolationConfirmed || !isStagingDeployment()) return;

  const problems = checkStagingValues(
    {
      supabaseUrl: publicEnv.supabaseUrl,
      supabaseAnonKey: publicEnv.supabaseAnonKey,
      appUrl: publicEnv.appUrl,
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
    environments,
  );

  if (problems.length > 0) {
    throw new Error(`Staging isolation check failed; not connecting to Supabase. ${problems.join(" ")}`);
  }
  stagingIsolationConfirmed = true;
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

/**
 * The shared secret a scheduler proves itself with.
 *
 * Null turns the cron route off entirely rather than leaving it open: a chaser
 * anybody can trigger is a way to make somebody's phone buzz on demand.
 */
export function getCronSecret(): string | null {
  return process.env.CRON_SECRET?.trim() || null;
}

/**
 * The wizard-resume feature flag (DRAFT_RESUME).
 *
 *   off  - default. The draft API answers 404 and the wizard behaves exactly as
 *          it did before drafts existed.
 *   test - the API is live, but the wizard only uses it on a page opened with
 *          ?resume_test=1, so it can be tried on a real phone without touching
 *          ad traffic.
 *   on   - every visitor.
 *
 * Anything unrecognised reads as off.
 */
export type DraftResumeMode = "off" | "test" | "on";

export function getDraftResumeMode(): DraftResumeMode {
  const raw = process.env.DRAFT_RESUME?.trim().toLowerCase();
  return raw === "on" || raw === "test" ? raw : "off";
}

/**
 * The oldest app build each platform may still use (MOBILE_MIN_VERSION_ANDROID,
 * MOBILE_MIN_VERSION_IOS), as major.minor.patch.
 *
 * Unset means every build is allowed. A malformed value is treated the same
 * way rather than as "block everything": a typo in a dashboard variable must
 * not lock every installed app out at once. Read per request, so raising it
 * needs no deploy.
 */
export function getMinimumAppVersions(): MinimumVersions {
  const read = (value: string | undefined) => {
    const trimmed = value?.trim() ?? "";
    return isValidVersion(trimmed) ? trimmed : "0.0.0";
  };

  return {
    android: read(process.env.MOBILE_MIN_VERSION_ANDROID),
    ios: read(process.env.MOBILE_MIN_VERSION_IOS),
  };
}

export interface WebPushConfig {
  publicKey: string;
  privateKey: string;
  /** Who a push service should contact about our traffic. RFC 8292 wants it. */
  subject: string;
}

/**
 * Browser push, when keys are configured.
 *
 * Null when they are not, and every caller treats that as "this feature is
 * off" - the same rule Telegram follows here. The app has to work
 * without it: the result page polls, the customer can keep the tab open, and
 * the admin still has Telegram. Push is the improvement, not the mechanism.
 *
 * The private key is read only here and only on the server. It is never given
 * to a client component, never prefixed NEXT_PUBLIC_, and the one value the
 * browser does need - the public key - is passed down as a prop from a server
 * component rather than inlined into the bundle.
 */
export function getWebPushConfig(): WebPushConfig | null {
  const publicKey = process.env.WEB_PUSH_PUBLIC_KEY?.trim();
  const privateKey = process.env.WEB_PUSH_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return null;

  return {
    publicKey,
    privateKey,
    // A contact address is required by the spec; push services may use it if
    // our traffic looks wrong. Configurable, with a sane default.
    subject: process.env.WEB_PUSH_SUBJECT?.trim() || "mailto:admin@snipsavor.com",
  };
}

/** The half of the keypair a browser needs to subscribe. Safe to hand out. */
export function getWebPushPublicKey(): string | null {
  return getWebPushConfig()?.publicKey ?? null;
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
