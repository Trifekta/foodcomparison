"use client";

/**
 * Whether adding this to the Home Screen would actually buy the customer
 * anything - which is a narrower question than "could they".
 *
 * Anybody can add any page to their Home Screen. The only person worth
 * mentioning it to is the one for whom it changes something, and here exactly
 * one person qualifies: an iPhone user in Safari. Apple does not deliver Web
 * Push to a browser tab under any circumstances, so for them the Home Screen
 * copy is the only way to be told their result is ready - which is the thing
 * the screen above has just promised.
 *
 * On Android the browser already does push. Suggesting an install there would
 * be an install prompt with nothing behind it, which is the thing this product
 * deliberately does not do.
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
 * Instagram's browser, Facebook's, and the rest of the embedded ones.
 *
 * The share sheet inside them either has no "Add to Home Screen" or hides it
 * behind "Open in Safari" first, so telling somebody to look for it there is an
 * instruction that does not work. Most of this product's traffic arrives this
 * way, and the right thing to do about it is say nothing: they still get the
 * result on the page, and the WhatsApp message the admin sends.
 */
function isEmbeddedBrowser(): boolean {
  const ua = navigator.userAgent;
  return /FBAN|FBAV|FB_IAB|Instagram|Line\/|Twitter|MicroMessenger|Snapchat/i.test(ua);
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
 * Every condition, in one place.
 *
 * Read after mount and never during render: half of these are browser-only
 * values, and reading them while rendering makes the server and the client
 * disagree.
 */
export function shouldOfferHomeScreen(pushIsSupported: boolean): boolean {
  if (typeof window === "undefined") return false;

  // Push works here already. Nothing to offer.
  if (pushIsSupported) return false;
  if (isStandalone()) return false;
  if (!isIos()) return false;
  if (isEmbeddedBrowser()) return false;
  return !wasDismissed();
}
