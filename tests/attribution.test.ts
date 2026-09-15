import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Capturing where a customer came from.
 *
 * The rule that matters most here is first touch. Somebody who lands from an
 * advert, wanders off to the privacy page and comes back with a clean URL has
 * not stopped being an advert click - and letting the second arrival overwrite
 * the first would quietly reassign every paid visit to "direct", which is the
 * exact number the campaign is being judged on.
 *
 * The environment is Node, so the browser globals this module needs are stood
 * up by hand rather than by a DOM library: it touches three of them and a fake
 * says more about what it depends on than jsdom would.
 */

const store = new Map<string, string>();

function visit(url: string, referrer = "") {
  const parsed = new URL(url);
  vi.stubGlobal("window", { location: { search: parsed.search, pathname: parsed.pathname, origin: parsed.origin } });
  vi.stubGlobal("document", { referrer });
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
  });
}

const { captureAttribution, currentAttribution, attributionFormFields } = await import(
  "@/lib/analytics/attribution"
);

beforeEach(() => {
  store.clear();
  vi.unstubAllGlobals();
});

describe("what is captured on arrival", () => {
  it("takes the campaign off the landing URL", () => {
    visit(
      "https://snipsavor.trifekta.io/?utm_source=instagram&utm_medium=paid_social&utm_campaign=validation_week1&utm_content=ad2_new_user",
    );
    captureAttribution();

    expect(currentAttribution()).toMatchObject({
      utmSource: "instagram",
      utmMedium: "paid_social",
      utmCampaign: "validation_week1",
      utmContent: "ad2_new_user",
      landingPath: "/",
    });
  });

  /** One column, because a visit only ever arrives with one of them. */
  it("keeps whichever ad platform's click id arrived", () => {
    visit("https://snipsavor.trifekta.io/?fbclid=IwAR0abc");
    captureAttribution();
    expect(currentAttribution().clickId).toBe("IwAR0abc");

    store.clear();
    visit("https://snipsavor.trifekta.io/compare?gclid=Cj0xyz");
    captureAttribution();
    expect(currentAttribution().clickId).toBe("Cj0xyz");
    expect(currentAttribution().landingPath).toBe("/compare");
  });

  it("does not let a later arrival overwrite the first", () => {
    visit("https://snipsavor.trifekta.io/?utm_campaign=validation_week1");
    captureAttribution();

    // Back from the privacy page, no parameters this time.
    visit("https://snipsavor.trifekta.io/");
    captureAttribution();

    expect(currentAttribution().utmCampaign).toBe("validation_week1");
  });

  /**
   * A visit with nothing on it is not worth a row of nulls - and storing one
   * would stop a later arrival that DOES carry a campaign from being seen.
   */
  it("stores nothing for a visit that carried nothing", () => {
    visit("https://snipsavor.trifekta.io/");
    captureAttribution();
    expect(store.size).toBe(0);

    visit("https://snipsavor.trifekta.io/?utm_source=instagram");
    captureAttribution();
    expect(currentAttribution().utmSource).toBe("instagram");
  });
});

describe("the referrer", () => {
  it("keeps where they came from and not what they were reading", () => {
    visit(
      "https://snipsavor.trifekta.io/",
      "https://www.instagram.com/p/Cxyz/?some=private&thing=here",
    );
    captureAttribution();
    // Origin only. "Which site" is ours to know; "which page" is not.
    expect(currentAttribution().referrer).toBe("https://www.instagram.com");
  });

  it("does not count our own pages as a referral", () => {
    visit("https://snipsavor.trifekta.io/compare", "https://snipsavor.trifekta.io/privacy");
    captureAttribution();
    expect(store.size).toBe(0);
  });
});

describe("what reaches the submission", () => {
  it("sends only the fields that have a value", () => {
    visit("https://snipsavor.trifekta.io/?utm_source=instagram&utm_campaign=week1");
    captureAttribution();

    const fields = attributionFormFields(currentAttribution());
    expect(fields).toEqual({
      utmSource: "instagram",
      utmCampaign: "week1",
      landingPath: "/",
    });
  });

  it("survives storage being switched off", () => {
    vi.stubGlobal("window", { location: { search: "?utm_source=x", pathname: "/", origin: "https://s.test" } });
    vi.stubGlobal("document", { referrer: "" });
    vi.stubGlobal("sessionStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });

    expect(() => captureAttribution()).not.toThrow();
    expect(currentAttribution().utmSource).toBeNull();
  });
});
