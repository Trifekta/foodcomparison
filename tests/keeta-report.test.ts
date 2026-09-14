import { describe, expect, it } from "vitest";
import { summarise } from "@/lib/keeta/report";

/**
 * Total taps and unique switchers are different numbers, and the difference is
 * the point: one says how many people acted, the other how much hesitation
 * there was on the way. Counted in JS because a distinct count is not something
 * PostgREST can express.
 */

const row = (submission: string, visit: string | null) => ({
  submission_id: submission,
  visit_id: visit,
});

describe("counting switches", () => {
  it("separates taps from the people making them", () => {
    const summary = summarise(
      [row("a", "v1"), row("a", "v1"), row("b", "v2")],
      10,
    );

    expect(summary.totalClicks).toBe(3);
    expect(summary.uniqueClicks).toBe(2);
    expect(summary.comparisonsClicked).toBe(2);
  });

  /**
   * A tap with no visit id is a browser with storage switched off. It is one
   * switcher we cannot deduplicate, so it counts as one - undercounting people
   * who actually switched is the worse error.
   */
  it("counts a tap with no visit id rather than dropping it", () => {
    const summary = summarise([row("a", null), row("a", null), row("b", "v1")], 4);
    expect(summary.totalClicks).toBe(3);
    expect(summary.uniqueClicks).toBe(3);
  });

  /**
   * The denominator is comparisons that HAD a button, not every submission.
   * Counting against every submission would fold our own turnaround time into a
   * number about customer behaviour - a slow week would look like a week nobody
   * wanted to switch.
   */
  it("rates against the comparisons that could have been tapped", () => {
    expect(summarise([row("a", "v1"), row("b", "v2")], 8).clickThroughRate).toBe(25);
    expect(summarise([row("a", "v1"), row("a", "v2")], 3).clickThroughRate).toBe(33.3);
  });

  it("is zero rather than NaN before anything has been compared", () => {
    expect(summarise([], 0)).toMatchObject({
      totalClicks: 0,
      uniqueClicks: 0,
      clickThroughRate: 0,
    });
  });
});
