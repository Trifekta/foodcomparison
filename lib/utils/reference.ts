/**
 * Customer-facing reference, e.g. FFA-260910-0042.
 *
 * FFA (FindFoodae) + YYMMDD + a random 4-digit suffix. The suffix is random rather than a
 * running sequence so references cannot be walked; the UUID primary key remains
 * the real identifier and nothing is authorised by reference alone.
 */
export const REFERENCE_PREFIX = "FFA";
export const REFERENCE_PATTERN = /^FFA-\d{6}-\d{4}$/;

export function formatReferenceDate(date: Date): string {
  const yy = String(date.getUTCFullYear()).slice(-2);
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return `${yy}${mm}${dd}`;
}

/**
 * Uniform random integer in [0, max).
 *
 * Uses Web Crypto, which is available on Node and on Cloudflare Workers alike,
 * so this module needs no Node built-ins. Rejection sampling keeps the
 * distribution even - taking a modulo alone would bias the low end.
 */
function randomBelow(max: number): number {
  const limit = Math.floor(0x1_0000_0000 / max) * max;
  const buffer = new Uint32Array(1);
  let value: number;
  do {
    crypto.getRandomValues(buffer);
    value = buffer[0];
  } while (value >= limit);
  return value % max;
}

/** Injectable randomness keeps this testable without stubbing crypto globally. */
export function generateReferenceNumber(
  date: Date = new Date(),
  random: (max: number) => number = randomBelow,
): string {
  const suffix = String(random(10000)).padStart(4, "0");
  return `${REFERENCE_PREFIX}-${formatReferenceDate(date)}-${suffix}`;
}

export function isValidReferenceNumber(value: string): boolean {
  return REFERENCE_PATTERN.test(value);
}

/**
 * The unguessable half of a submission's identity.
 *
 * The reference number above is a date and four random digits - ten thousand
 * per day - which is fine for something people quote back at us and useless as
 * a key to anything. This is the key: 128 bits of randomness, hex so it
 * survives a URL, a copy-paste and a WhatsApp preview intact. It appears in
 * exactly one place, the link we send the customer, and grants sight of that
 * one submission.
 */
export function generateResultToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export const RESULT_TOKEN_PATTERN = /^[0-9a-f]{32}$/;

/** Rejects a malformed token before it ever reaches the database. */
export function isValidResultToken(value: string): boolean {
  return RESULT_TOKEN_PATTERN.test(value);
}

/** The customer-facing path for a result. Relative, so any host works. */
export function resultPath(token: string): string {
  return `/r/${token}`;
}
