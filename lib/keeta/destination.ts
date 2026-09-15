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
 * The hostnames Keeta actually serves the UAE from.
 *
 * Checked against real share links rather than assumed from the brand name,
 * which is how the first version of this list came to say "keeta.com" and would
 * have refused every genuine link:
 *
 *  - url-eu.mykeeta.com is what the Keeta app puts on the clipboard. It is the
 *    one an admin pastes, so it is the one that matters.
 *  - m-eu and fooddelivery1-eu are where those links land, carrying region=AE.
 *    Allowed so that a resolved link works too, since an admin who followed the
 *    link before copying has pasted something equally genuine.
 *
 * keeta.com itself is deliberately absent: it is not what the UAE app produces,
 * and keeta-global.com is the corporate site rather than anywhere a customer
 * orders food. A link to either is far more likely to be a mistake than a shop.
 */
const DEFAULT_KEETA_HOSTS = [
  "url-eu.mykeeta.com",
  "m-eu.mykeeta.com",
  "fooddelivery1-eu.mykeeta.com",
] as const;

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
 * The comparison is on the whole hostname, so nothing that merely contains or
 * ends in the right letters gets through: notmykeeta.com, mykeeta.com.evil.test
 * and evil.test/url-eu.mykeeta.com are all refused.
 */
/**
 * The check itself, against a list handed in.
 *
 * Split out so the admin form can run exactly this logic in the browser while
 * the redirect runs it on the server: the allowlist lives in an environment
 * variable the browser cannot read, so the page is given the hosts as a prop
 * and the rule stays in one place. Two copies of a security check are two
 * chances for them to disagree, and the one that disagrees is the one nobody
 * tested.
 */
export function checkKeetaDestinationAgainst(
  value: string | null | undefined,
  hosts: readonly string[],
): DestinationCheck {
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

  // Exact hostnames, deliberately. Matching subdomains too would turn
  // "mykeeta.com" in this list into *.mykeeta.com, and a company's entire
  // domain tree is a much larger promise than "these three addresses serve
  // restaurants in Dubai" - one forgotten staging or user-content subdomain and
  // the allowlist is decoration. Another host means another entry.
  const host = url.hostname.toLowerCase();
  if (!hosts.includes(host)) {
    return { ok: false, reason: "host_not_allowed" };
  }

  // Normalised through the URL parser, so what is stored and what is sent are
  // the same string and neither is whatever was in the paste buffer.
  return { ok: true, url: url.toString(), host };
}

/** The same check, against whatever this deployment allows. Server-side. */
export function checkKeetaDestination(value: string | null | undefined): DestinationCheck {
  return checkKeetaDestinationAgainst(value, allowedKeetaHosts());
}

/** For the admin form, which should refuse before a customer ever meets the link. */
export function isApprovedKeetaUrl(value: string | null | undefined): boolean {
  return checkKeetaDestination(value).ok;
}

/**
 * Said in the admin's terms, at the moment of pasting.
 *
 * Names the hosts rather than saying "invalid", because the admin is holding a
 * link they believe is right and the useful information is which addresses this
 * deployment will accept.
 */
export function describeRefusalForAdmin(
  reason: DestinationRefusal,
  hosts: readonly string[],
): string {
  switch (reason) {
    case "missing":
      return "Paste the restaurant's link from the app.";
    case "unparseable":
      return "That is not a link. Copy it again from the app's share option.";
    case "not_https":
      return "That link is not https. Copy the share link rather than typing an address.";
    case "has_credentials":
      return "That link carries a username or password, which no real share link does.";
    case "host_not_allowed":
      return `Not a ${COMPARISON_APP} link. Accepted: ${hosts.join(", ")}.`;
  }
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
