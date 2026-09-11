/**
 * The reference a person quotes back at us.
 *
 * Six characters, no dashes, no date: short enough to read aloud down a phone,
 * type with one thumb, or copy off a WhatsApp message without losing your place.
 * It replaces FFA-260911-1850, which was fifteen characters of which eleven
 * told the customer nothing they needed.
 *
 * The alphabet leaves out 0, 1, I, L, O and U - the characters people mistype
 * for each other and the ones that make words nobody wants printed on their
 * order. What is left is 30 symbols, so 729 million references; the insert
 * retries on the rare collision.
 *
 * This is a HANDLE, not a key. It identifies an order in a conversation and
 * authorises nothing on its own: the result page is addressed by the token
 * below, and looking an order up by reference also asks for the contact detail
 * it was sent to. Six characters would be far too few for anything else.
 */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
const REFERENCE_LENGTH = 6;

export const REFERENCE_PATTERN = new RegExp(`^[${ALPHABET}]{${REFERENCE_LENGTH}}$`);

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
  random: (max: number) => number = randomBelow,
): string {
  let reference = "";
  for (let index = 0; index < REFERENCE_LENGTH; index += 1) {
    reference += ALPHABET[random(ALPHABET.length)];
  }
  return reference;
}

/**
 * Tidies what someone typed into what we stored.
 *
 * Uppercase, and nothing but letters and digits: people type lowercase, add a
 * space in the middle, and paste it with a full stop on the end. No character
 * is remapped, because the alphabet has already removed every pair worth
 * confusing - there is no 0 to mistake for an O, and no 1 for an I.
 */
export function normaliseReference(input: string): string {
  return input.toUpperCase().replace(/[^0-9A-Z]/g, "");
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
