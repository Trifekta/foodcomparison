import { afterEach, describe, expect, it } from "vitest";
import {
  allowedKeetaHosts,
  checkKeetaDestination,
  isApprovedKeetaUrl,
} from "@/lib/keeta/destination";

/**
 * The open-redirect guard.
 *
 * /go/ is the one address in this product designed to be followed off-site, on
 * a domain customers are being taught to trust. A redirect that forwards
 * anywhere is a phishing tool with our name in the address bar, so what this
 * file protects is not our data but somebody else's trust.
 */

const ORIGINAL = process.env.KEETA_ALLOWED_HOSTS;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.KEETA_ALLOWED_HOSTS;
  else process.env.KEETA_ALLOWED_HOSTS = ORIGINAL;
});

describe("which hosts are allowed", () => {
  it("falls back to the hosts Keeta actually serves the UAE from", () => {
    delete process.env.KEETA_ALLOWED_HOSTS;
    expect(allowedKeetaHosts()).toEqual([
      "url-eu.mykeeta.com",
      "m-eu.mykeeta.com",
      "fooddelivery1-eu.mykeeta.com",
    ]);
  });

  it("is replaced outright by the environment, not merged with it", () => {
    process.env.KEETA_ALLOWED_HOSTS = "url-eu.mykeeta.com, M-EU.MYKEETA.COM ,.keeta.ae";
    // Lowercased, trimmed, leading dots removed - so a value typed three
    // different ways by three different people behaves the same.
    expect(allowedKeetaHosts()).toEqual(["url-eu.mykeeta.com", "m-eu.mykeeta.com", "keeta.ae"]);
  });
});

describe("what /go/ will send somebody to", () => {
  it("allows a real UAE share link", () => {
    delete process.env.KEETA_ALLOWED_HOSTS;
    for (const url of [
      "https://url-eu.mykeeta.com/share/abc123",
      "https://m-eu.mykeeta.com/shop/9911?region=AE",
      "https://fooddelivery1-eu.mykeeta.com/x?region=AE",
    ]) {
      expect(checkKeetaDestination(url).ok, url).toBe(true);
    }
  });

  /**
   * The whole point of listing hostnames rather than a domain. Allowing
   * subdomains would make any one of these entries mean *.mykeeta.com, and a
   * company's entire domain tree is a much larger promise than three addresses
   * that serve restaurants.
   */
  it("does not treat the allowlist as a domain wildcard", () => {
    delete process.env.KEETA_ALLOWED_HOSTS;
    for (const url of [
      "https://mykeeta.com/x",
      "https://anything.mykeeta.com/x",
      "https://staging.url-eu.mykeeta.com/x",
      "https://keeta.com/restaurant/123",
      "https://keeta-global.com/x",
    ]) {
      expect(checkKeetaDestination(url).ok, url).toBe(false);
    }
  });

  /**
   * The app's own deep link. Refused on purpose: a scheme we do not control is
   * not something to hand a browser, and the https share link launches the app
   * by itself anyway.
   */
  it("refuses the sailorc:// app deep link", () => {
    delete process.env.KEETA_ALLOWED_HOSTS;
    expect(checkKeetaDestination("sailorc://keeta.com/shop/1")).toMatchObject({
      reason: "not_https",
    });
  });

  /**
   * The reason this compares against a dot boundary rather than calling
   * endsWith on the bare name. Both of these end in the allowed letters and
   * neither is Keeta.
   */
  it("refuses a host that merely looks like the approved one", () => {
    delete process.env.KEETA_ALLOWED_HOSTS;
    for (const url of [
      "https://notmykeeta.com/x",
      "https://url-eu.mykeeta.com.evil.test/x",
      "https://evil.test/url-eu.mykeeta.com",
      "https://keeta-offers.xyz/shop/1",
    ]) {
      const outcome = checkKeetaDestination(url);
      expect(outcome.ok, url).toBe(false);
      expect(outcome.ok ? "" : outcome.reason).toBe("host_not_allowed");
    }
  });

  it("refuses anything that is not https", () => {
    process.env.KEETA_ALLOWED_HOSTS = "url-eu.mykeeta.com";
    expect(checkKeetaDestination("http://url-eu.mykeeta.com/x")).toMatchObject({
      reason: "not_https",
    });
    // javascript: and data: parse perfectly well as URLs - that is exactly why
    // the check is on the protocol and not on whether the parse succeeded.
    expect(checkKeetaDestination("javascript:alert(1)")).toMatchObject({ reason: "not_https" });
    expect(checkKeetaDestination("data:text/html,<script>")).toMatchObject({
      reason: "not_https",
    });
    // A protocol-relative link has no protocol to check, so it fails earlier.
    expect(checkKeetaDestination("//url-eu.mykeeta.com/x")).toMatchObject({
      reason: "unparseable",
    });
  });

  /**
   * https://keeta.com@evil.test/ is a link to evil.test and reads to a person
   * as a link to Keeta. It is the oldest trick in this category.
   */
  it("refuses a URL carrying credentials", () => {
    process.env.KEETA_ALLOWED_HOSTS = "url-eu.mykeeta.com";
    const outcome = checkKeetaDestination("https://url-eu.mykeeta.com@evil.test/login");
    expect(outcome.ok).toBe(false);
    expect(outcome.ok ? "" : outcome.reason).toBe("has_credentials");
  });

  it("refuses an empty or missing link rather than guessing", () => {
    expect(checkKeetaDestination(null)).toMatchObject({ reason: "missing" });
    expect(checkKeetaDestination("   ")).toMatchObject({ reason: "missing" });
  });

  it("returns the URL normalised, so what is stored is what was sent", () => {
    process.env.KEETA_ALLOWED_HOSTS = "url-eu.mykeeta.com";
    const outcome = checkKeetaDestination("https://URL-EU.MyKeeta.com/share/9");
    expect(outcome.ok && outcome.url).toBe("https://url-eu.mykeeta.com/share/9");
  });

  it("agrees with the helper the admin form uses", () => {
    process.env.KEETA_ALLOWED_HOSTS = "url-eu.mykeeta.com";
    expect(isApprovedKeetaUrl("https://url-eu.mykeeta.com/x")).toBe(true);
    expect(isApprovedKeetaUrl("https://keeta-offers.xyz/x")).toBe(false);
  });
});

/**
 * The same rule, at the moment the admin pastes.
 *
 * Two layers deliberately: the form refuses to save a link the redirect would
 * refuse to follow, so the mistake is caught while the admin still has the link
 * on their clipboard rather than by a customer who taps a button and lands on
 * an apology. The redirect still checks again - a row can be written by
 * something other than this form, and an allowlist that changes after a link
 * was saved is exactly what the later check exists for.
 */
describe("saving a comparison", () => {
  it("refuses a link that is not a Keeta link", async () => {
    process.env.KEETA_ALLOWED_HOSTS = "url-eu.mykeeta.com";
    const { comparisonInputSchema } = await import("@/lib/validation/admin");

    const base = {
      submissionId: "11111111-1111-4111-8111-111111111111",
      comparisonTotal: "58.00",
    };

    for (const bad of [
      "https://keeta-offers.xyz/shop/1",
      "https://url-eu.mykeeta.com.evil.test/x",
      "https://keeta.com/restaurant/1",
      "http://url-eu.mykeeta.com/x",
    ]) {
      const outcome = comparisonInputSchema.safeParse({ ...base, comparisonUrl: bad });
      expect(outcome.success, bad).toBe(false);
    }
  });

  it("accepts the link the Keeta app actually produces", async () => {
    process.env.KEETA_ALLOWED_HOSTS = "url-eu.mykeeta.com";
    const { comparisonInputSchema } = await import("@/lib/validation/admin");

    const outcome = comparisonInputSchema.safeParse({
      submissionId: "11111111-1111-4111-8111-111111111111",
      comparisonTotal: "58.00",
      comparisonUrl: "https://url-eu.mykeeta.com/share/abc123",
    });
    expect(outcome.success).toBe(true);
  });

  it("names the accepted hosts, so the admin knows what to paste instead", async () => {
    process.env.KEETA_ALLOWED_HOSTS = "url-eu.mykeeta.com";
    const { comparisonInputSchema } = await import("@/lib/validation/admin");

    const outcome = comparisonInputSchema.safeParse({
      submissionId: "11111111-1111-4111-8111-111111111111",
      comparisonTotal: "58.00",
      comparisonUrl: "https://keeta-offers.xyz/shop/1",
    });
    const message = outcome.success ? "" : outcome.error.issues.map((i) => i.message).join(" ");
    expect(message).toContain("url-eu.mykeeta.com");
  });
});
