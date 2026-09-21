import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Counting the round trip to a food app, from the landing page.
 *
 * The flag under test answers one question - "of the people we sent to Talabat
 * from the landing page, how many came back" - and the ways it can lie are all
 * about lifetime. Armed too eagerly it counts lock screens; consumed too
 * loosely it counts one return several times; shared with the wizard it eats
 * the wizard's own welcome-back. Each of those is a test here.
 *
 * Node environment, so sessionStorage is stood up by hand: a fake says exactly
 * what this module touches, and lets a test make storage throw the way a
 * private window does.
 */

let store = new Map<string, string>();
let throws = false;

vi.stubGlobal("sessionStorage", {
  getItem: (key: string) => {
    if (throws) throw new Error("storage is off");
    return store.get(key) ?? null;
  },
  setItem: (key: string, value: string) => {
    if (throws) throw new Error("storage is off");
    store.set(key, value);
  },
  removeItem: (key: string) => {
    if (throws) throw new Error("storage is off");
    store.delete(key);
  },
});

const { markLeavingLandingForApp, consumeReturnToLanding } = await import(
  "@/lib/customer/landing-session"
);
const { markLeavingForApp, consumeReturnFromApp } = await import(
  "@/lib/customer/wizard-session"
);

beforeEach(() => {
  store = new Map();
  throws = false;
});

describe("the landing page's away flag", () => {
  it("reports no return when nobody left", () => {
    expect(consumeReturnToLanding()).toBe(false);
  });

  it("reports a return once a tile was tapped", () => {
    markLeavingLandingForApp();

    expect(consumeReturnToLanding()).toBe(true);
  });

  it("reports that return only once", () => {
    markLeavingLandingForApp();

    expect(consumeReturnToLanding()).toBe(true);
    // A customer who comes back and then glances at a message is one return,
    // not two - the second visibilitychange must find the flag disarmed.
    expect(consumeReturnToLanding()).toBe(false);
  });

  it("survives storage being switched off", () => {
    throws = true;

    // Private mode. The return goes uncounted; nothing throws at the customer.
    expect(() => markLeavingLandingForApp()).not.toThrow();
    expect(consumeReturnToLanding()).toBe(false);
  });
});

describe("the landing flag and the wizard flag", () => {
  /**
   * The reason these are two keys and not one.
   *
   * The wizard's flag means "restore their half-filled form and greet them".
   * Consuming it from the landing page would silently cancel that greeting for
   * the rest of the tab, for a customer who had never been near the wizard.
   */
  it("does not consume each other's", () => {
    markLeavingForApp();

    expect(consumeReturnToLanding()).toBe(false);
    expect(consumeReturnFromApp()).toBe(true);
  });

  it("leaves the wizard's greeting armed when the landing page is the one that left", () => {
    markLeavingLandingForApp();

    expect(consumeReturnFromApp()).toBe(false);
    expect(consumeReturnToLanding()).toBe(true);
  });
});
