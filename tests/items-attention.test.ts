import { describe, expect, it } from "vitest";
import { itemsNeedAttention } from "@/components/customer/wizard/types";
import type { CartItemDraft } from "@/components/customer/wizard/types";

/**
 * Whether the confirm screen opens the item list, or waits to be asked.
 *
 * Folding the items away is what makes one screen out of three bearable, and
 * it is also the one change in that merge that can hide something worth
 * seeing. The rule that decides it is therefore worth pinning down here rather
 * than discovering on somebody's phone: the rows a person most needs to look
 * at are exactly the rows a collapsed panel makes invisible.
 */

const item = (over: Partial<CartItemDraft> = {}): CartItemDraft => ({
  key: crypto.randomUUID(),
  name: "Chicken shawarma",
  quantity: 1,
  linePrice: "21.00",
  proposed: null,
  ...over,
});

describe("whether the item list opens itself", () => {
  it("stays shut for a clean read", () => {
    // The case this whole fold exists for: the extraction got it right, and
    // nobody should have to scroll past four correct rows to reach the button.
    expect(itemsNeedAttention({ status: "applied", items: [item(), item()] })).toBe(false);
  });

  it("opens when a price was flagged", () => {
    // priceUncertain renders a "check" badge - a currency glyph welded onto a
    // number turning 39.00 into 539.00 - which is worth nothing unseen.
    expect(
      itemsNeedAttention({
        status: "applied",
        items: [item(), item({ priceUncertain: true, linePrice: "539.00" })],
      }),
    ).toBe(true);
  });

  it("opens when the read found nothing", () => {
    // An empty list behind "View or edit items" is a dead end. Open, it is an
    // invitation to type what they ordered.
    expect(itemsNeedAttention({ status: "empty", items: [] })).toBe(true);
  });

  it("opens when no read ever ran", () => {
    expect(itemsNeedAttention({ status: "idle", items: [] })).toBe(true);
  });

  it("stays shut while the read is still running", () => {
    // The list is about to change. A panel that springs open and then fills
    // itself underneath somebody is the worst version of both states - and
    // this is the one input that arrives after the screen has mounted.
    expect(itemsNeedAttention({ status: "reading", items: [] })).toBe(false);
  });

  it("does not reopen once a flagged price has been touched", () => {
    // Editing the field clears the flag, which is the customer answering the
    // question the badge was asking. It must not keep asking.
    expect(
      itemsNeedAttention({
        status: "applied",
        items: [item({ priceUncertain: false, linePrice: "39.00" })],
      }),
    ).toBe(false);
  });
});
