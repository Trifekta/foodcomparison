import { describe, expect, it } from "vitest";
import {
  FUNNEL_STEPS,
  computeFunnel,
  isFunnelEvent,
  isValidVisitId,
} from "@/lib/analytics/funnel";

/**
 * The funnel counts VISITS, not events.
 *
 * That distinction is the whole point: a customer who taps back and forward
 * records a step several times, and counting those would produce a funnel where
 * more people reach step three than ever started.
 */

const visits = (event: string, ids: string[]) => ids.map((visit_id) => ({ event, visit_id }));

/**
 * Looked up by name rather than by position.
 *
 * These used to index the array, which meant adding a step to the top of the
 * funnel - exactly what happened when the landing page started being counted -
 * broke tests that were not about the landing page at all.
 */
const step = (funnel: ReturnType<typeof computeFunnel>, event: string) => {
  const found = funnel.find((row) => row.event === event);
  if (!found) throw new Error(`No ${event} in the funnel`);
  return found;
};

describe("computeFunnel", () => {
  it("counts a visit once however many times it records a step", () => {
    const rows = [
      ...visits("wizard_started", ["a", "b", "c", "d"]),
      ...visits("step_basket", ["a", "a", "a", "b", "c"]),
    ];
    const funnel = computeFunnel(rows);

    expect(step(funnel, "wizard_started").count).toBe(4);
    expect(step(funnel, "step_basket").count).toBe(3);
  });

  it("says what each screen costs, which is the number to act on", () => {
    const rows = [
      ...visits("wizard_started", ["a", "b", "c", "d"]),
      ...visits("step_basket", ["a", "b", "c"]),
      ...visits("step_where", ["a"]),
    ];
    const funnel = computeFunnel(rows);

    expect(step(funnel, "step_basket").dropFromPrevious).toBe(25);
    // Two of the three who confirmed a basket stopped at the next screen.
    expect(step(funnel, "step_where").dropFromPrevious).toBeCloseTo(66.67, 1);
  });

  /**
   * The landing page is the baseline now, which is the point of counting it:
   * every later share is "out of everybody the advert brought", not "out of
   * everybody who already decided to start".
   */
  it("measures every step against the people who landed", () => {
    const rows = [
      ...visits("landing_viewed", ["a", "b", "c", "d"]),
      ...visits("wizard_started", ["a", "b"]),
      ...visits("step_basket", ["a"]),
    ];
    const funnel = computeFunnel(rows);

    expect(funnel[0].event).toBe("landing_viewed");
    expect(step(funnel, "landing_viewed").count).toBe(4);
    // Half the people the advert paid for never started. That is the number
    // the old funnel could not see at all.
    expect(step(funnel, "wizard_started").shareOfStart).toBe(50);
    expect(step(funnel, "wizard_started").dropFromPrevious).toBe(50);
    expect(step(funnel, "step_basket").shareOfStart).toBe(25);
  });

  it("reports every step, including the ones nobody reached", () => {
    const funnel = computeFunnel(visits("wizard_started", ["a"]));
    expect(funnel).toHaveLength(FUNNEL_STEPS.length);
    expect(funnel.at(-1)).toMatchObject({ event: "keeta_opened", count: 0 });
  });

  it("does not divide by zero on an empty pilot", () => {
    const funnel = computeFunnel([]);
    expect(funnel.every((step) => step.count === 0)).toBe(true);
    expect(funnel.every((step) => Number.isFinite(step.shareOfStart))).toBe(true);
    expect(funnel.every((step) => Number.isFinite(step.dropFromPrevious))).toBe(true);
  });

  it("survives a later step outnumbering an earlier one", () => {
    // A result link opened on a phone that never saw the wizard is exactly
    // this, and it must not produce a negative drop.
    const rows = [
      ...visits("wizard_started", ["a"]),
      ...visits("result_viewed", ["x", "y", "z"]),
    ];
    const funnel = computeFunnel(rows);
    expect(funnel.every((step) => step.dropFromPrevious >= 0)).toBe(true);
  });
});

describe("what the endpoint will accept", () => {
  it("takes the known steps and nothing else", () => {
    for (const step of FUNNEL_STEPS) expect(isFunnelEvent(step.event)).toBe(true);
    for (const bad of ["", "step_basket ", "STEP_BASKET", "drop table", "custom_event"]) {
      expect(isFunnelEvent(bad), `for ${bad}`).toBe(false);
    }
  });

  it("takes a visit id of the shape the database will store", () => {
    expect(isValidVisitId("0123456789abcdef")).toBe(true);
    for (const bad of ["", "short", "0123456789ABCDEF", "0123456789abcdefg".repeat(3), "../etc"]) {
      expect(isValidVisitId(bad), `for ${bad}`).toBe(false);
    }
  });
});
