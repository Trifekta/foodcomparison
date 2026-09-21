import { describe, expect, it } from "vitest";
import { autoAdvanceTarget } from "@/components/customer/wizard/types";

/**
 * When a screen hands the customer on by itself.
 *
 * The flow asks for one thing per screen and then moves, the way the app it
 * compares against does. That is pleasant when it is right and hostile when it
 * is wrong - a screen that changes underneath somebody, or a Back button that
 * throws them forward again, costs more than the taps it saved.
 */

const base = {
  step: 1,
  status: "applied" as const,
  hasFile: true,
  cartSettled: false,
  alreadyAdvanced: false,
};

describe("when a screen hands over by itself", () => {
  it("waits while the screenshot is still being read", () => {
    // The read is the whole reason to move. Moving before it lands would put
    // somebody on a screen that is still filling itself in.
    expect(autoAdvanceTarget({ ...base, status: "reading" })).toBeNull();
  });

  it("does nothing before a screenshot has been chosen", () => {
    expect(autoAdvanceTarget({ ...base, hasFile: false, status: "idle" })).toBeNull();
  });

  it("moves from the cart to the total screen once the cart is read", () => {
    expect(autoAdvanceTarget(base)).toBe(2);
  });

  it("moves on even when the read came back empty", () => {
    // An unreadable screenshot is not a reason to strand somebody: the next
    // screen is where they can type the number themselves.
    expect(autoAdvanceTarget({ ...base, status: "empty" })).toBe(2);
  });

  it("skips the total screen when the cart already settled the bill", () => {
    // Talabat, noon and Keeta print the whole payment summary on the cart
    // page. Putting a screen in front of somebody to ask for what they have
    // already sent is the friction this flow exists against.
    expect(autoAdvanceTarget({ ...base, cartSettled: true })).toBe(3);
  });

  it("never moves off the total screen, whatever the read found", () => {
    // The moment its read lands is the moment that screen finally has
    // something to say - here is what you paid - so it is the worst possible
    // moment to leave. Somebody who uploads a payment summary and never sees
    // their own total has been shown nothing.
    expect(autoAdvanceTarget({ ...base, step: 2 })).toBeNull();
    // And the mirror case: nothing readable on it means the total screen is
    // exactly where they type the number themselves.
    expect(autoAdvanceTarget({ ...base, step: 2, status: "empty" })).toBeNull();
  });

  it("never hands over twice from the same screen", () => {
    // What makes Back usable. The read on the screen behind is still finished,
    // so without this the customer is thrown forward the moment they go back.
    expect(autoAdvanceTarget({ ...base, alreadyAdvanced: true })).toBeNull();
  });

  it("never hands over from the confirm screen", () => {
    // Nothing past it to hand over to, and it is the screen somebody sends
    // from - the last thing it should do is move.
    expect(autoAdvanceTarget({ ...base, step: 3 })).toBeNull();
  });
});
