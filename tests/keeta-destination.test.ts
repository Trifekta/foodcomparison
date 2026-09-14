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
  it("falls back to Keeta's own domain when nothing is configured", () => {
    delete process.env.KEETA_ALLOWED_HOSTS;
    expect(allowedKeetaHosts()).toEqual(["keeta.com"]);
  });

  it("is replaced outright by the environment, not merged with it", () => {
    process.env.KEETA_ALLOWED_HOSTS = "keeta.ae, KEETA.COM ,.keetaapp.com";
    // Lowercased, trimmed, leading dots removed - so a value typed three
    // different ways by three different people behaves the same.
    expect(allowedKeetaHosts()).toEqual(["keeta.ae", "keeta.com", "keetaapp.com"]);
  });
});

describe("what /go/ will send somebody to", () => {
  it("allows the approved host and its subdomains", () => {
    process.env.KEETA_ALLOWED_HOSTS = "keeta.com";
    for (const url of [
      "https://keeta.com/restaurant/123",
      "https://ae.keeta.com/r/9?utm=x",
      "https://www.keeta.com/",
    ]) {
      expect(checkKeetaDestination(url).ok, url).toBe(true);
    }
  });

  /**
   * The reason this compares against a dot boundary rather than calling
   * endsWith on the bare name. Both of these end in the allowed letters and
   * neither is Keeta.
   */
  it("refuses a host that merely looks like the approved one", () => {
    process.env.KEETA_ALLOWED_HOSTS = "keeta.com";
    for (const url of [
      "https://notkeeta.com/x",
      "https://keeta.com.evil.test/x",
      "https://evil.test/keeta.com",
      "https://keeta.evil.test/",
    ]) {
      const outcome = checkKeetaDestination(url);
      expect(outcome.ok, url).toBe(false);
      expect(outcome.ok ? "" : outcome.reason).toBe("host_not_allowed");
    }
  });

  it("refuses anything that is not https", () => {
    process.env.KEETA_ALLOWED_HOSTS = "keeta.com";
    expect(checkKeetaDestination("http://keeta.com/x")).toMatchObject({ reason: "not_https" });
    // javascript: and data: parse perfectly well as URLs - that is exactly why
    // the check is on the protocol and not on whether the parse succeeded.
    expect(checkKeetaDestination("javascript:alert(1)")).toMatchObject({ reason: "not_https" });
    expect(checkKeetaDestination("data:text/html,<script>")).toMatchObject({
      reason: "not_https",
    });
    // A protocol-relative link has no protocol to check, so it fails earlier.
    expect(checkKeetaDestination("//keeta.com/x")).toMatchObject({ reason: "unparseable" });
  });

  /**
   * https://keeta.com@evil.test/ is a link to evil.test and reads to a person
   * as a link to Keeta. It is the oldest trick in this category.
   */
  it("refuses a URL carrying credentials", () => {
    process.env.KEETA_ALLOWED_HOSTS = "keeta.com";
    const outcome = checkKeetaDestination("https://keeta.com@evil.test/login");
    expect(outcome.ok).toBe(false);
    expect(outcome.ok ? "" : outcome.reason).toBe("has_credentials");
  });

  it("refuses an empty or missing link rather than guessing", () => {
    expect(checkKeetaDestination(null)).toMatchObject({ reason: "missing" });
    expect(checkKeetaDestination("   ")).toMatchObject({ reason: "missing" });
  });

  it("returns the URL normalised, so what is stored is what was sent", () => {
    process.env.KEETA_ALLOWED_HOSTS = "keeta.com";
    const outcome = checkKeetaDestination("https://KEETA.com/restaurant/9");
    expect(outcome.ok && outcome.url).toBe("https://keeta.com/restaurant/9");
  });

  it("agrees with the helper the admin form uses", () => {
    process.env.KEETA_ALLOWED_HOSTS = "keeta.com";
    expect(isApprovedKeetaUrl("https://keeta.com/x")).toBe(true);
    expect(isApprovedKeetaUrl("https://evil.test/x")).toBe(false);
  });
});
