/**
 * The bearer token that reconnects a browser to its wizard draft.
 *
 * 32 random bytes, base64url - 256 bits, far past guessing. The server mints
 * it; the database keeps only its SHA-256 (see 0027_wizard_drafts.sql), so the
 * table alone cannot be used to open a draft.
 *
 * Isomorphic: Web Crypto exists in browsers, Node and Cloudflare Workers.
 */

const TOKEN_BYTES = 32;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function isWellFormedDraftToken(value: unknown): value is string {
  return typeof value === "string" && TOKEN_PATTERN.test(value);
}

export function generateDraftToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function hashDraftToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
