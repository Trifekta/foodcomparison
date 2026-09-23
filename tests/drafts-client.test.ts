import { describe, expect, it } from "vitest";
import {
  isResumeActive,
  tokenFromFragment,
  withFragmentToken,
} from "@/lib/drafts/client";
import { generateDraftToken, hashDraftToken, isWellFormedDraftToken } from "@/lib/drafts/token";
import { draftProgressSchema, draftValuesFrom } from "@/lib/drafts/progress";
import { restoredStep } from "@/lib/customer/wizard-session";
import { WIZARD_DEFAULTS } from "@/components/customer/wizard/types";

/**
 * The browser-side rules: where the token lives in a URL, when drafts are on
 * for a page, and where a restored wizard lands.
 */

const TOKEN = generateDraftToken();

describe("draft tokens", () => {
  it("are 256 random bits, url-safe, and never repeat", () => {
    const seen = new Set(Array.from({ length: 200 }, generateDraftToken));
    expect(seen.size).toBe(200);
    for (const token of seen) expect(isWellFormedDraftToken(token)).toBe(true);
  });

  it("hash to 64 hex characters that do not contain the token", async () => {
    const hash = await hashDraftToken(TOKEN);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(TOKEN);
  });
});

describe("the URL fragment", () => {
  it("is written without touching the path or query", () => {
    const next = withFragmentToken("https://snipsavor.test/compare?resume_test=1&utm_source=ig", TOKEN);
    const url = new URL(next);
    expect(url.pathname).toBe("/compare");
    expect(url.search).toBe("?resume_test=1&utm_source=ig");
    expect(url.hash).toBe(`#resume=${TOKEN}`);
    expect(tokenFromFragment(url.hash)).toBe(TOKEN);
  });

  it("keeps any other fragment content, and can be removed again", () => {
    const withOther = withFragmentToken("https://snipsavor.test/compare#foo=bar", TOKEN);
    expect(tokenFromFragment(new URL(withOther).hash)).toBe(TOKEN);
    const removed = withFragmentToken(withOther, null);
    expect(new URL(removed).hash).toBe("#foo=bar");
    expect(withFragmentToken(`https://snipsavor.test/compare#resume=${TOKEN}`, null)).toBe(
      "https://snipsavor.test/compare",
    );
  });

  it("ignores anything that is not a well-formed token", () => {
    expect(tokenFromFragment("#resume=abc")).toBeNull();
    expect(tokenFromFragment("")).toBeNull();
    expect(tokenFromFragment(`#resume=${TOKEN}x`)).toBeNull();
  });
});

describe("the feature flag in the browser", () => {
  it("is off unless switched on, and test mode needs the page opted in", () => {
    expect(isResumeActive("off", "?resume_test=1")).toBe(false);
    expect(isResumeActive("on", "")).toBe(true);
    expect(isResumeActive("test", "")).toBe(false);
    expect(isResumeActive("test", "?utm_source=ig")).toBe(false);
    expect(isResumeActive("test", "?resume_test=1")).toBe(true);
  });
});

describe("where a restored wizard lands", () => {
  it("returns to the confirm step when the screenshot came back with it", () => {
    expect(restoredStep(2, true, 1)).toBe(2);
    expect(restoredStep(1, true, 1)).toBe(1);
  });

  it("falls back to upload only when no screenshot could be restored", () => {
    expect(restoredStep(2, false, 1)).toBe(1);
  });
});

describe("draft progress", () => {
  it("never carries the phone number from the form", () => {
    const values = draftValuesFrom({ ...WIZARD_DEFAULTS, whatsappNumber: "501234567" });
    expect(JSON.stringify(values)).not.toContain("501234567");
    const parsed = draftProgressSchema.parse({
      step: 1,
      values: { ...values, whatsappNumber: "501234567" },
      items: [],
      autofilled: null,
      reads: { cart: null, checkout: null },
    });
    expect(JSON.stringify(parsed)).not.toContain("501234567");
  });
});
