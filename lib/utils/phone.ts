/**
 * Phone normalisation for WhatsApp contact.
 *
 * Stored in E.164 without the leading "+" so it can be dropped straight into a
 * wa.me link. UAE numbers are the common case: customers type 050 123 4567,
 * 50 123 4567 or +971 50 123 4567 and all three must land on the same value.
 */

export interface NormalisedPhone {
  /** E.164 with "+", e.g. +971501234567. Stored on the submission. */
  e164: string;
  /** Digits only, e.g. 971501234567. Used for wa.me links. */
  digits: string;
}

export class PhoneNormalisationError extends Error {}

export function normalisePhone(dialCode: string, input: string): NormalisedPhone {
  const cleanDial = dialCode.replace(/[^\d]/g, "");
  if (!cleanDial) throw new PhoneNormalisationError("Missing country code");

  let national = input.replace(/[^\d]/g, "");
  if (!national) throw new PhoneNormalisationError("Missing number");

  // Tolerate a pasted international number: 00971..., 971..., +971...
  if (national.startsWith("00")) national = national.slice(2);
  if (national.startsWith(cleanDial) && national.length > cleanDial.length) {
    national = national.slice(cleanDial.length);
  }
  // Local trunk prefix, e.g. 050 -> 50.
  national = national.replace(/^0+/, "");

  if (national.length < 6 || national.length > 12) {
    throw new PhoneNormalisationError("Number length looks wrong");
  }

  const digits = `${cleanDial}${national}`;
  return { e164: `+${digits}`, digits };
}

export function isNormalisablePhone(dialCode: string, input: string): boolean {
  try {
    normalisePhone(dialCode, input);
    return true;
  } catch {
    return false;
  }
}

/** Masks a stored number for review screens: +971501234567 -> "XXXX 4567". */
export function maskPhone(e164: string): string {
  const digits = e164.replace(/[^\d]/g, "");
  return `•••• ${digits.slice(-4)}`;
}

/** Masks an email for review screens: someone@example.com -> "so...@example.com". */
export function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return "•••";
  const head = user.slice(0, 2);
  return `${head}•••@${domain}`;
}
