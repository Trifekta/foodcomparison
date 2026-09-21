import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Surviving the trip to another app.
 *
 * The wizard asks people to leave - open Talabat, build a basket, screenshot
 * it, come back - and a backgrounded tab on a phone is routinely discarded and
 * rebuilt on return. These are the rules that decide what comes back with them
 * and where they land, which are worth pinning down here rather than
 * discovering on somebody's phone.
 *
 * Node environment, so sessionStorage is stood up by hand: a fake says exactly
 * what this module touches, and lets a test make storage throw the way a
 * private window does.
 */

let store = new Map<string, string>();
let throws = false;

function stubStorage() {
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
}

const {
  clearWizardSession,
  consumeReturnFromApp,
  hasProgress,
  loadWizardSession,
  markLeavingForApp,
  restoredStep,
  saveWizardSession,
} = await import("@/lib/customer/wizard-session");

const { WIZARD_DEFAULTS, shouldAutofillTotal } = await import(
  "@/components/customer/wizard/types"
);

const STEP_UPLOAD = 1;

beforeEach(() => {
  store = new Map();
  throws = false;
  stubStorage();
});

describe("where a returning customer lands", () => {
  it("puts them on the upload step when the screenshot did not survive", () => {
    // The only case that reaches a restore: the tab was rebuilt, so every File
    // is gone however far along they were.
    expect(restoredStep(2, false, STEP_UPLOAD)).toBe(STEP_UPLOAD);
  });

  it("leaves a later step alone when a screenshot is still in hand", () => {
    expect(restoredStep(2, true, STEP_UPLOAD)).toBe(2);
  });

  it("never lands before the upload step", () => {
    expect(restoredStep(0, true, STEP_UPLOAD)).toBe(STEP_UPLOAD);
    expect(restoredStep(-2, true, STEP_UPLOAD)).toBe(STEP_UPLOAD);
  });
});

describe("what comes back", () => {
  it("returns what was stored", () => {
    saveWizardSession({
      step: 2,
      values: { ...WIZARD_DEFAULTS, restaurantName: "Al Safadi", currentTotal: "82.00" },
      items: [{ key: "a", name: "Mixed grill", quantity: 2, linePrice: "60.00", proposed: null }],
      autofilled: null,
    });

    const loaded = loadWizardSession();
    expect(loaded?.step).toBe(2);
    expect(loaded?.values.restaurantName).toBe("Al Safadi");
    expect(loaded?.values.currentTotal).toBe("82.00");
    expect(loaded?.items).toHaveLength(1);
    expect(loaded?.items[0].name).toBe("Mixed grill");
  });

  it("is null when nothing was ever stored", () => {
    expect(loadWizardSession()).toBeNull();
  });

  it("is null rather than a crash on unparseable storage", () => {
    store.set("snipsavor.wizard", "{not json");
    expect(loadWizardSession()).toBeNull();
  });

  it("drops fields the wizard no longer has, and defaults ones it gained", () => {
    // A shape written by an older deploy. The stored object may only contribute
    // the fields that still exist; everything else comes from the defaults.
    store.set(
      "snipsavor.wizard",
      JSON.stringify({ step: 2, values: { restaurantName: "Zaroob", removedField: "x" }, items: [] }),
    );

    const loaded = loadWizardSession();
    expect(loaded?.values.restaurantName).toBe("Zaroob");
    expect(loaded?.values).not.toHaveProperty("removedField");
    expect(loaded?.values.dialCode).toBe(WIZARD_DEFAULTS.dialCode);
  });

  it("refuses a stored value of the wrong type instead of handing it to the form", () => {
    store.set(
      "snipsavor.wizard",
      JSON.stringify({ step: 1, values: { restaurantName: 42 }, items: [] }),
    );
    expect(loadWizardSession()?.values.restaurantName).toBe(WIZARD_DEFAULTS.restaurantName);
  });

  it("drops item rows that are not item rows", () => {
    store.set(
      "snipsavor.wizard",
      JSON.stringify({
        step: 1,
        values: {},
        items: [{ key: "a", name: "Shawarma", quantity: 1 }, null, { name: "no key" }, 7],
      }),
    );
    expect(loadWizardSession()?.items).toHaveLength(1);
  });

  it("survives storage being switched off", () => {
    throws = true;
    expect(loadWizardSession()).toBeNull();
    // And none of the writers throw either - a private window must not take the
    // wizard down with it.
    expect(() => saveWizardSession({ step: 1, values: WIZARD_DEFAULTS, items: [], autofilled: null })).not.toThrow();
    expect(() => clearWizardSession()).not.toThrow();
    expect(() => markLeavingForApp()).not.toThrow();
    expect(consumeReturnFromApp()).toBe(false);
  });
});

describe("the flag that says they went shopping", () => {
  it("is false until a food-app link is tapped", () => {
    // The bug this replaces: the flag was armed by any visibilitychange, so a
    // tab switch or a lock screen counted as a trip to Talabat, and everyone
    // got greeted on the way back from nowhere.
    expect(consumeReturnFromApp()).toBe(false);
  });

  it("is true exactly once after a tap", () => {
    markLeavingForApp();
    expect(consumeReturnFromApp()).toBe(true);
    expect(consumeReturnFromApp()).toBe(false);
  });

  it("is dropped along with the session when the order is sent", () => {
    markLeavingForApp();
    saveWizardSession({ step: 2, values: WIZARD_DEFAULTS, items: [], autofilled: null });
    clearWizardSession();

    expect(loadWizardSession()).toBeNull();
    expect(consumeReturnFromApp()).toBe(false);
  });
});

/**
 * Whether the greeting may claim their work survived.
 *
 * The visit this whole flow exists for is an advert click who taps through to
 * Talabat from an empty step one. Telling them everything they entered is safe
 * when they entered nothing is a system talking to itself.
 */
describe("whether a restored session carries anything", () => {
  it("is false for a session that only holds the defaults", () => {
    expect(hasProgress({ step: 1, values: WIZARD_DEFAULTS, items: [], autofilled: null })).toBe(false);
  });

  it("is false when the untouched dial code is the only non-empty field", () => {
    // "+971" is there because nobody chose it, so it is not progress.
    expect(
      hasProgress({ step: 1, values: { ...WIZARD_DEFAULTS, dialCode: "+971" }, items: [], autofilled: null }),
    ).toBe(false);
  });

  it("is true once they have typed a field", () => {
    expect(
      hasProgress({ step: 2, values: { ...WIZARD_DEFAULTS, restaurantName: "Zaroob" }, items: [], autofilled: null }),
    ).toBe(true);
  });

  it("is true when only the item list survived", () => {
    expect(
      hasProgress({
        step: 2,
        values: WIZARD_DEFAULTS,
        items: [{ key: "a", name: "Shawarma", quantity: 1, linePrice: null, proposed: null }],
        autofilled: null,
      }),
    ).toBe(true);
  });
});

/**
 * The memory of which total the wizard filled in for itself.
 *
 * This is the bug it exists for, and it needed no bad screenshot and no bad
 * model to happen. The autofill will not write over a figure the customer
 * typed - their reading of their own screen beats ours - so it has to be able
 * to tell its own value from theirs. That memory lived in a ref while the
 * value itself lived in sessionStorage, and a reload destroys one and keeps
 * the other.
 *
 * After which the form holds a number with no history, every later read is
 * treated as an attempt to overwrite the customer, and the field is frozen on
 * its first reading for the life of the tab. The round trip to a food app -
 * the thing this whole module exists to survive - is exactly what triggers it,
 * because coming back puts them on the upload step to send the screenshot
 * again.
 */
describe("remembering which total was ours", () => {
  it("stores it beside the value it explains", () => {
    saveWizardSession({
      step: 2,
      values: { ...WIZARD_DEFAULTS, currentTotal: "63.50" },
      items: [],
      autofilled: "63.50",
    });

    expect(loadWizardSession()?.autofilled).toBe("63.50");
  });

  it("is null for a total the customer typed themselves", () => {
    saveWizardSession({
      step: 2,
      values: { ...WIZARD_DEFAULTS, currentTotal: "80.00" },
      items: [],
      autofilled: null,
    });

    expect(loadWizardSession()?.autofilled).toBeNull();
  });

  it("defaults to null rather than trusting a stored shape of the wrong type", () => {
    store.set(
      "snipsavor.wizard",
      JSON.stringify({ step: 1, values: {}, items: [], autofilled: 63.5 }),
    );
    expect(loadWizardSession()?.autofilled).toBeNull();
  });

  it("lets a later read replace a restored total that was ours", () => {
    // The whole point. Without the stored memory this arrives as
    // lastAutofilled: null and the read is refused.
    saveWizardSession({
      step: 1,
      values: { ...WIZARD_DEFAULTS, currentTotal: "63.50" },
      items: [],
      autofilled: "63.50",
    });
    const restored = loadWizardSession();

    expect(
      shouldAutofillTotal({
        readFinalTotal: "56.68",
        typed: restored?.values.currentTotal ?? "",
        lastAutofilled: restored?.autofilled ?? null,
      }),
    ).toBe(true);
  });

  it("still leaves a restored total the customer typed alone", () => {
    saveWizardSession({
      step: 1,
      values: { ...WIZARD_DEFAULTS, currentTotal: "80.00" },
      items: [],
      autofilled: null,
    });
    const restored = loadWizardSession();

    expect(
      shouldAutofillTotal({
        readFinalTotal: "56.68",
        typed: restored?.values.currentTotal ?? "",
        lastAutofilled: restored?.autofilled ?? null,
      }),
    ).toBe(false);
  });
});
