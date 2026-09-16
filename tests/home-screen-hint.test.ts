import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Who is shown the Home Screen suggestion, and - mostly - who is not.
 *
 * This is the one place in the product that says anything resembling "install
 * us", so the rules about staying quiet matter more than the rule about
 * speaking. It earns its place on exactly one screen, for exactly one person:
 * an iPhone user in Safari, waiting for a result they have been promised a
 * notification about, which Apple will not deliver to a browser tab.
 */

const store = new Map<string, string>();

function browser({
  ua,
  standalone = false,
  touchPoints = 5,
}: {
  ua: string;
  standalone?: boolean;
  touchPoints?: number;
}) {
  vi.stubGlobal("window", {
    matchMedia: () => ({ matches: standalone }),
    navigator: { standalone: standalone ? true : undefined },
  });
  vi.stubGlobal("navigator", { userAgent: ua, maxTouchPoints: touchPoints, standalone });
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
  });
}

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Mobile Safari/537.36";
const INSTAGRAM_IOS = `${IPHONE_SAFARI} Instagram 320.0.0.0 (iPhone16,2; iOS 17_4)`;
const FACEBOOK_IOS = `${IPHONE_SAFARI} [FBAN/FBIOS;FBAV/450.0.0]`;

const { shouldOfferHomeScreen, dismissHomeScreenHint, isStandalone } = await import(
  "@/lib/pwa/install"
);

beforeEach(() => {
  store.clear();
  vi.unstubAllGlobals();
});

describe("who is offered the Home Screen", () => {
  it("an iPhone in Safari, where push cannot reach a tab", () => {
    browser({ ua: IPHONE_SAFARI });
    expect(shouldOfferHomeScreen(false)).toBe(true);
  });

  /**
   * Android's browser already does push. Saying this there would be an install
   * suggestion with nothing behind it, which is the thing this product
   * deliberately does not do.
   */
  it("never Android, where the browser already sends notifications", () => {
    browser({ ua: ANDROID_CHROME });
    expect(shouldOfferHomeScreen(true)).toBe(false);
  });

  it("never when push already works, whatever the device", () => {
    browser({ ua: IPHONE_SAFARI });
    expect(shouldOfferHomeScreen(true)).toBe(false);
  });

  /**
   * Most of this product's traffic arrives inside these. Their share sheets
   * either lack "Add to Home Screen" or bury it behind opening Safari first,
   * so the instruction would simply not work.
   */
  it("never inside Instagram's or Facebook's browser", () => {
    for (const ua of [INSTAGRAM_IOS, FACEBOOK_IOS]) {
      browser({ ua });
      expect(shouldOfferHomeScreen(false), ua.slice(0, 40)).toBe(false);
    }
  });

  it("never once it is already installed", () => {
    browser({ ua: IPHONE_SAFARI, standalone: true });
    expect(shouldOfferHomeScreen(false)).toBe(false);
  });

  /** One tap, and it is gone for good. */
  it("never again once dismissed", () => {
    browser({ ua: IPHONE_SAFARI });
    expect(shouldOfferHomeScreen(false)).toBe(true);
    dismissHomeScreenHint();
    expect(shouldOfferHomeScreen(false)).toBe(false);
  });

  /** An iPad reports itself as a Mac and is told apart by its touch points. */
  it("recognises an iPad, and does not mistake a desktop Mac for one", () => {
    const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1";
    browser({ ua: MAC, touchPoints: 5 });
    expect(shouldOfferHomeScreen(false)).toBe(true);

    browser({ ua: MAC, touchPoints: 0 });
    expect(shouldOfferHomeScreen(false)).toBe(false);
  });

  it("survives storage being switched off", () => {
    vi.stubGlobal("window", { matchMedia: () => ({ matches: false }), navigator: {} });
    vi.stubGlobal("navigator", { userAgent: IPHONE_SAFARI, maxTouchPoints: 5 });
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    });

    expect(() => dismissHomeScreenHint()).not.toThrow();
    expect(shouldOfferHomeScreen(false)).toBe(true);
  });
});

describe("standalone detection", () => {
  it("is true for a Home Screen copy and false for a tab", () => {
    browser({ ua: IPHONE_SAFARI, standalone: true });
    expect(isStandalone()).toBe(true);

    browser({ ua: IPHONE_SAFARI });
    expect(isStandalone()).toBe(false);
  });
});
