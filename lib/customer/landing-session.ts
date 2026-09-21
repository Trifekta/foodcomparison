/**
 * Whether this visit left the LANDING page for a food app.
 *
 * A near-copy of the away flag in wizard-session.ts, and deliberately not a
 * shared one. The wizard's flag means "restore their half-filled form and greet
 * them" - a promise about work in progress. The landing page has no work in
 * progress to protect; its flag means only "count the return". Sharing one key
 * would let whichever screen read it first consume the other's, so a customer
 * who left from the landing page and came back to it would silently disarm the
 * wizard's welcome-back for the rest of the tab.
 *
 * sessionStorage for the same reason the wizard uses it: the lifetime wanted is
 * exactly a tab's. It survives the backgrounding and the reload that a phone
 * under memory pressure inflicts on a page while somebody is off in Talabat,
 * and it dies with the tab rather than following them into next week.
 *
 * Armed by a deliberate tap on one of the four tiles and by nothing else - the
 * same rule wizard-session.ts arrived at the hard way. Arming it from
 * visibilitychange would count every lock screen, notification shade and app
 * switch as "went shopping", and the return number this exists to produce would
 * measure nothing but how often people glance at their phones.
 */

const AWAY_KEY = "snipsavor.landing.away";

/** Armed by tapping a food-app tile on the landing page, and by nothing else. */
export function markLeavingLandingForApp(): void {
  try {
    sessionStorage.setItem(AWAY_KEY, "1");
  } catch {
    // Private mode, or storage switched off. The return goes uncounted; the
    // customer's screen is untouched, which is the only part that matters.
  }
}

/**
 * True once per departure: reading it disarms the flag.
 *
 * Once, because the question is "did they come back", not "how many times did
 * this tab regain focus afterwards". Left armed, a customer who returns and
 * then switches away to answer a message would be counted as two returns and a
 * second departure that never happened.
 */
export function consumeReturnToLanding(): boolean {
  try {
    if (sessionStorage.getItem(AWAY_KEY) !== "1") return false;
    sessionStorage.removeItem(AWAY_KEY);
    return true;
  } catch {
    return false;
  }
}
