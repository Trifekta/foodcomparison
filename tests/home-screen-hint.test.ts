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

const { homeScreenRoute, dismissHomeScreenHint, isStandalone } = await import("@/lib/pwa/install");

beforeEach(() => {
  store.clear();
  vi.unstubAllGlobals();
});

const ANDROID_INSTAGRAM =
  "Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124 Mobile Safari/537.36 Instagram 320.0.0.0 Android";

describe("what this customer is told", () => {
  it("an iPhone in Safari gets the two taps, and nothing else", () => {
    browser({ ua: IPHONE_SAFARI });
    expect(homeScreenRoute(false)).toBe("ios-direct");
  });

  /**
   * The long road, and the only one there is: iOS sends push to a Home Screen
   * copy and to nothing else, so somebody who arrived from an advert has to
   * leave Instagram's browser first. Said out loud rather than hidden, because
   * an instruction with a missing step is one nobody finishes.
   */
  it("an iPhone inside Instagram is sent to Safari first", () => {
    for (const ua of [INSTAGRAM_IOS, FACEBOOK_IOS]) {
      browser({ ua });
      expect(homeScreenRoute(false), ua.slice(0, 40)).toBe("ios-in-app");
    }
  });

  /**
   * Much easier. Chrome does push in an ordinary tab, so leaving the embedded
   * browser IS the fix and there is nothing to install.
   */
  it("an Android inside Instagram is sent to Chrome, not to an install", () => {
    browser({ ua: ANDROID_INSTAGRAM });
    expect(homeScreenRoute(false)).toBe("android-in-app");
  });

  it("says nothing when the browser can already reach them", () => {
    browser({ ua: ANDROID_CHROME });
    expect(homeScreenRoute(true)).toBeNull();

    browser({ ua: IPHONE_SAFARI });
    expect(homeScreenRoute(true)).toBeNull();
  });

  /**
   * Android's own browser already does push, so an Android that cannot is an
   * embedded one - and if it is not Instagram's or Facebook's, its menu is not
   * something to give instructions about.
   */
  it("says nothing in an embedded browser whose menu we cannot vouch for", () => {
    browser({ ua: `${IPHONE_SAFARI} Snapchat/12.0` });
    expect(homeScreenRoute(false)).toBeNull();

    browser({ ua: `${ANDROID_CHROME} TikTok/33.0` });
    expect(homeScreenRoute(false)).toBeNull();
  });

  it("says nothing once it is already installed", () => {
    browser({ ua: IPHONE_SAFARI, standalone: true });
    expect(homeScreenRoute(false)).toBeNull();
  });

  /** One tap, and it is gone for good - on every route. */
  it("says nothing again once dismissed", () => {
    browser({ ua: INSTAGRAM_IOS });
    expect(homeScreenRoute(false)).toBe("ios-in-app");
    dismissHomeScreenHint();
    expect(homeScreenRoute(false)).toBeNull();
  });

  /** An iPad reports itself as a Mac and is told apart by its touch points. */
  it("recognises an iPad, and does not mistake a desktop Mac for one", () => {
    const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1";
    browser({ ua: MAC, touchPoints: 5 });
    expect(homeScreenRoute(false)).toBe("ios-direct");

    browser({ ua: MAC, touchPoints: 0 });
    expect(homeScreenRoute(false)).toBeNull();
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
    expect(homeScreenRoute(false)).toBe("ios-direct");
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
