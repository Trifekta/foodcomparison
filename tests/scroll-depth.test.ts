import { describe, expect, it } from "vitest";
import { percentSeen, scrollBucket, scrollEvent, SCROLL_EVENTS } from "@/lib/analytics/scroll";
import { scrollDepthDistribution } from "@/lib/calculations/scroll-depth";
import { isFunnelEvent, isSideEvent, isTrackedEvent } from "@/lib/analytics/funnel";

/**
 * How far down a screen somebody got.
 *
 * The reading is taken to the BOTTOM of the viewport, which is the whole of
 * what makes it honest on a phone: somebody who never scrolls has still seen a
 * screenful, and measuring to the top would file every short visit as having
 * seen nothing at all.
 */
describe("the share of a page that has been on screen", () => {
  it("counts the first screenful as seen without any scrolling", () => {
    // 800 of 1600 visible at rest is half the page, not none of it.
    expect(percentSeen(0, 800, 1600)).toBe(50);
  });

  it("is 100 at the bottom", () => {
    expect(percentSeen(800, 800, 1600)).toBe(100);
  });

  it("is 100 for a page that fits the screen", () => {
    // Nothing to scroll, so arriving is seeing all of it. Dividing by a
    // scrollable height of zero here would have produced Infinity or NaN.
    expect(percentSeen(0, 900, 600)).toBe(100);
    expect(percentSeen(0, 900, 900)).toBe(100);
  });

  it("survives a page height of zero", () => {
    expect(percentSeen(0, 800, 0)).toBe(100);
  });

  it("clamps the overscroll a phone reports at both ends", () => {
    // iOS rubber-banding hands back a scrollY past the end, and a negative one
    // at the top; neither is a reading above 100 or below 0.
    expect(percentSeen(1200, 800, 1600)).toBe(100);
    expect(percentSeen(-60, 800, 1600)).toBe(50);
  });
});

describe("which bucket a reading falls in", () => {
  it("takes the deepest bucket the reading reaches", () => {
    expect(scrollBucket(100)).toBe(100);
    expect(scrollBucket(99.9)).toBe(75);
    expect(scrollBucket(75)).toBe(75);
    expect(scrollBucket(50)).toBe(50);
    expect(scrollBucket(26)).toBe(25);
  });

  it("gives a shallow visit a bucket of its own rather than none", () => {
    // The most interesting cohort there is - they saw the top and left - so it
    // has to be recorded, not dropped for failing to clear the first mark.
    expect(scrollBucket(24)).toBe(0);
    expect(scrollBucket(0)).toBe(0);
  });

  it("names an event that the server will actually store", () => {
    for (const percent of [0, 24, 25, 50, 75, 100]) {
      const event = scrollEvent(percent);
      expect(isTrackedEvent(event)).toBe(true);
      // Side events, never funnel steps: computeFunnel measures each step
      // against the one above it, and a mark most visits never post would
      // report a collapse that never happened.
      expect(isSideEvent(event)).toBe(true);
      expect(isFunnelEvent(event)).toBe(false);
    }
  });

  it("lists the buckets shallowest first, so a distribution reads downward", () => {
    expect(SCROLL_EVENTS).toEqual([
      "scroll_0",
      "scroll_25",
      "scroll_50",
      "scroll_75",
      "scroll_100",
    ]);
  });
});

describe("the distribution the dashboard shows", () => {
  it("counts one visit per bucket", () => {
    const { items, visits } = scrollDepthDistribution([
      { event: "scroll_0", visit_id: "a" },
      { event: "scroll_100", visit_id: "b" },
      { event: "scroll_100", visit_id: "c" },
    ]);

    expect(visits).toBe(3);
    expect(items.find((i) => i.label === "Saw the top only")?.count).toBe(1);
    expect(items.find((i) => i.label === "Reached the bottom")?.count).toBe(2);
  });

  it("keeps the deepest reading when one visit posted two", () => {
    // Stepping back to the upload screen remounts the tracker, so a second and
    // possibly shallower mark arrives. It is the same visit, and it must not
    // drag the first one down.
    const { items, visits } = scrollDepthDistribution([
      { event: "scroll_100", visit_id: "a" },
      { event: "scroll_0", visit_id: "a" },
    ]);

    expect(visits).toBe(1);
    expect(items.find((i) => i.label === "Reached the bottom")?.count).toBe(1);
    expect(items.find((i) => i.label === "Saw the top only")?.count).toBe(0);
  });

  it("ignores every other event in the table", () => {
    // It reads the funnel's own rows, so most of what it is handed is not a
    // scroll mark at all.
    const { visits } = scrollDepthDistribution([
      { event: "wizard_started", visit_id: "a" },
      { event: "cart_uploaded", visit_id: "a" },
      { event: "app_opened", visit_id: "a" },
    ]);
    expect(visits).toBe(0);
  });

  it("returns every bucket even when nothing landed in it", () => {
    // The shape is what the bars render from, so a missing bucket would be a
    // gap in the chart rather than a zero.
    const { items } = scrollDepthDistribution([{ event: "scroll_50", visit_id: "a" }]);
    expect(items).toHaveLength(5);
    expect(items.map((i) => i.count)).toEqual([0, 0, 1, 0, 0]);
  });

  it("is empty, not broken, before anything has been recorded", () => {
    const { items, visits } = scrollDepthDistribution([]);
    expect(visits).toBe(0);
    expect(items.every((i) => i.count === 0)).toBe(true);
  });
});
