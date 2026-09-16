"use client";

/**
 * How this customer could be reached, when the browser they are in cannot
 * reach them.
 *
 * The question is never "could they install this" - anybody can add any page to
 * their Home Screen. It is "can we tell them their result is ready", and the
 * answer depends on two things the browser will not volunteer: whose browser it
 * is, and whether it is somebody else's browser embedded in an app.
 *
 * During validation a result is produced by a person and takes a few minutes,
 * so the customer has genuinely gone. That makes this the difference between a
 * result they see and a result they miss, rather than a convenience.
 */

const DISMISSED = "snipsavor.homescreen.dismissed";

/** Already installed: there is nothing left to suggest. */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      // Safari's own, which predates the standard and is still the only one
      // iOS sets for a Home Screen app.
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true
    );
  } catch {
    return false;
  }
}

function isIos(): boolean {
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac, and is told apart by the touch points -
  // no desktop Mac has them.
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

/**
 * Instagram's browser and Facebook's, which is where the adverts land.
 *
 * Told apart from the other embedded browsers because these two are the only
 * ones whose menu is known to carry "Open in Safari" / "Open in Chrome" - so
 * these are the only ones where an instruction can be given that actually
 * works. For anything else embedded, nothing is said at all.
 */
function isMetaBrowser(): boolean {
  return /FBAN|FBAV|FB_IAB|Instagram/i.test(navigator.userAgent);
}

function isOtherEmbeddedBrowser(): boolean {
  const ua = navigator.userAgent;
  return !isMetaBrowser() && /Line\/|Twitter|MicroMessenger|Snapchat|TikTok/i.test(ua);
}

export function dismissHomeScreenHint(): void {
  try {
    localStorage.setItem(DISMISSED, "1");
  } catch {
    // Storage off. The hint reappears next visit, which is a smaller problem
    // than the hint failing to appear at all.
  }
}

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISSED) === "1";
  } catch {
    return false;
  }
}

/**
 * What to tell this customer, if anything.
 *
 *  - "ios-direct"      Safari on an iPhone. Share, then Add to Home Screen.
 *  - "ios-in-app"      Inside Instagram or Facebook on an iPhone. Safari first,
 *                      then the same two taps. A longer road, and the only one
 *                      there is: iOS sends push to a Home Screen copy and to
 *                      nothing else.
 *  - "android-in-app"  Inside Instagram or Facebook on Android. Much easier -
 *                      Chrome does push in an ordinary tab, so opening it there
 *                      is the whole fix and nothing needs installing.
 *  - null              Say nothing.
 */
export type HomeScreenRoute = "ios-direct" | "ios-in-app" | "android-in-app" | null;

/**
 * Read after mount and never during render: every value behind this is
 * browser-only, and reading them while rendering makes the server and the
 * client disagree.
 */
export function homeScreenRoute(pushIsSupported: boolean): HomeScreenRoute {
  if (typeof window === "undefined") return null;

  // The browser can already reach them. Nothing to say.
  if (pushIsSupported) return null;
  if (isStandalone()) return null;
  if (wasDismissed()) return null;

  // An embedded browser whose menu we cannot vouch for. An instruction that
  // does not match what somebody sees is worse than silence.
  if (isOtherEmbeddedBrowser()) return null;

  if (isIos()) return isMetaBrowser() ? "ios-in-app" : "ios-direct";

  // Android, and push is unavailable - which on Android means an embedded
  // WebView rather than a real browser. Chrome fixes it without an install.
  return isMetaBrowser() ? "android-in-app" : null;
}
