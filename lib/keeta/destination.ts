import { COMPARISON_APP } from "@/lib/constants";

/**
 * What /go/ is allowed to send somebody to.
 *
 * A redirect endpoint that forwards to whatever it is given is an open
 * redirect, and an open redirect on a domain customers are learning to trust is
 * a phishing tool with our name on it: snipsavor.trifekta.io/go/... in the
 * address bar, somebody else's login form at the end of it. The destination is
 * typed by an admin rather than by the public, so this is not the usual
 * untrusted-input case - but a mistyped paste, a compromised admin account and
 * a stolen session all end in the same place, and the check costs nothing.
 *
 * So the rule is an allowlist, not a blocklist, and it is checked at the moment
 * of redirecting rather than only when the link was saved. A row already in the
 * database is exactly the thing a later check has to catch.
 */

/**
 * Keeta's own domains.
 *
 * Kept here as the default and overridable by environment, because a delivery
 * company adding a regional domain must not need a deploy - and because the
 * value that matters is whatever Keeta is actually using in the UAE the day a
 * customer taps, which this file cannot know for certain.
 */
const DEFAULT_KEETA_HOSTS = ["keeta.com"] as const;

/**
 * Hosts we will redirect to, lowercased and without a leading dot.
 *
 * KEETA_ALLOWED_HOSTS is a comma-separated list and replaces the default
 * outright rather than adding to it, so a mistake can be corrected by setting
 * one variable rather than by working out what it was merged with.
 */
export function allowedKeetaHosts(): string[] {
  const configured = process.env.KEETA_ALLOWED_HOSTS?.trim();
  const list = configured
    ? configured.split(",")
    : (DEFAULT_KEETA_HOSTS as readonly string[]).slice();

  return list
    .map((host) => host.trim().toLowerCase().replace(/^\.+/, ""))
    .filter((host) => host.length > 0);
}

export type DestinationRefusal =
  | "missing"
  | "unparseable"
  | "not_https"
  | "host_not_allowed"
  | "has_credentials";

export type DestinationCheck =
  | { ok: true; url: string; host: string }
  | { ok: false; reason: DestinationRefusal };

/**
 * Whether this is a Keeta address we are willing to send a customer to.
 *
 * Subdomains count - `ae.keeta.com` is Keeta - and a host that merely ends in
 * the same letters does not: `notkeeta.com` and `keeta.com.evil.test` are both
 * refused, which is the whole reason this compares against a dot boundary
 * rather than calling endsWith on the bare name.
 */
export function checkKeetaDestination(value: string | null | undefined): DestinationCheck {
  const raw = (value ?? "").trim();
  if (!raw) return { ok: false, reason: "missing" };

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "unparseable" };
  }

  // https only. Nothing else is a link to a shop: javascript: and data: are
  // scripts, and http: is a downgrade on a page a customer reached over TLS.
  if (url.protocol !== "https:") return { ok: false, reason: "not_https" };

  // https://keeta.com@evil.test/ is a link to evil.test, and reads to a person
  // as a link to Keeta. Nothing legitimate here carries credentials.
  if (url.username || url.password) return { ok: false, reason: "has_credentials" };

  const host = url.hostname.toLowerCase();
  const allowed = allowedKeetaHosts().some(
    (candidate) => host === candidate || host.endsWith(`.${candidate}`),
  );

  if (!allowed) return { ok: false, reason: "host_not_allowed" };

  // Normalised through the URL parser, so what is stored and what is sent are
  // the same string and neither is whatever was in the paste buffer.
  return { ok: true, url: url.toString(), host };
}

/** For the admin form, which should warn before a customer ever meets the link. */
export function isApprovedKeetaUrl(value: string | null | undefined): boolean {
  return checkKeetaDestination(value).ok;
}

/** Said in the admin's terms, for a log line and the fallback page. */
export function describeRefusal(reason: DestinationRefusal): string {
  switch (reason) {
    case "missing":
      return "No comparison link is saved on this submission.";
    case "unparseable":
      return "The saved link is not a URL.";
    case "not_https":
      return "The saved link is not https.";
    case "has_credentials":
      return "The saved link carries a username or password, which no real link does.";
    case "host_not_allowed":
      return `The saved link does not point at an approved ${COMPARISON_APP} domain (${allowedKeetaHosts().join(", ")}).`;
  }
}
