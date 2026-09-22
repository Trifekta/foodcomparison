import { describe, expect, it } from "vitest";
import { summarizeLivePresence, type PresenceRow } from "@/lib/calculations/presence";

const NOW = Date.parse("2026-09-18T12:00:00Z");
const secondsAgo = (seconds: number): string =>
  new Date(NOW - seconds * 1000).toISOString();

const row = (overrides: Partial<PresenceRow>): PresenceRow => ({
  visit_id: "abc123",
  last_seen_at: secondsAgo(10),
  last_event: "wizard_started",
  ...overrides,
});

describe("summarizeLivePresence", () => {
  it("counts a visit seen just now as active", () => {
    const summary = summarizeLivePresence([row({ last_seen_at: secondsAgo(5) })], NOW);
    expect(summary.activeCount).toBe(1);
  });

  it("drops a visit last seen beyond the active window", () => {
    const summary = summarizeLivePresence(
      [row({ last_seen_at: secondsAgo(3 * 60) })],
      NOW,
      2 * 60_000,
    );
    expect(summary.activeCount).toBe(0);
  });

  it("keeps a visit right at the edge of the window", () => {
    // 119 seconds is inside a 2-minute window; 121 is not.
    const inside = summarizeLivePresence([row({ last_seen_at: secondsAgo(119) })], NOW, 120_000);
    const outside = summarizeLivePresence([row({ last_seen_at: secondsAgo(121) })], NOW, 120_000);
    expect(inside.activeCount).toBe(1);
    expect(outside.activeCount).toBe(0);
  });

  it("counts a heartbeat-only visit as arrived, not on a step", () => {
    const summary = summarizeLivePresence([row({ last_event: null })], NOW);
    expect(summary.activeCount).toBe(1);
    expect(summary.arrivedCount).toBe(1);
    expect(summary.byStep).toEqual([]);
  });

  it("groups active visits by their current step", () => {
    const summary = summarizeLivePresence(
      [
        row({ visit_id: "a", last_event: "step_where" }),
        row({ visit_id: "b", last_event: "step_where" }),
        row({ visit_id: "c", last_event: "submitted" }),
      ],
      NOW,
    );

    expect(summary.activeCount).toBe(3);
    expect(summary.arrivedCount).toBe(0);
    expect(summary.byStep).toEqual([
      { event: "step_where", label: "Chose their delivery area", count: 2, kind: "step" },
      { event: "submitted", label: "Sent the order", count: 1, kind: "step" },
    ]);
  });

  it("orders steps by the funnel, not by how the rows arrived", () => {
    const summary = summarizeLivePresence(
      [
        row({ visit_id: "a", last_event: "keeta_opened" }),
        row({ visit_id: "b", last_event: "landing_viewed" }),
      ],
      NOW,
    );

    expect(summary.byStep.map((step) => step.event)).toEqual([
      "landing_viewed",
      "keeta_opened",
    ]);
  });

  it("gives a visit sitting on a side event its own chip", () => {
    const summary = summarizeLivePresence([row({ last_event: "cta_example" })], NOW);

    expect(summary.activeCount).toBe(1);
    expect(summary.arrivedCount).toBe(0);
    expect(summary.byStep).toEqual([
      { event: "cta_example", label: "Opened the example", count: 1, kind: "side" },
    ]);
  });

  it("puts the detours after the funnel rungs, whatever order the rows came in", () => {
    const summary = summarizeLivePresence(
      [
        row({ visit_id: "a", last_event: "cta_example" }),
        row({ visit_id: "b", last_event: "landing_viewed" }),
        row({ visit_id: "c", last_event: "app_opened" }),
        row({ visit_id: "d", last_event: "submitted" }),
      ],
      NOW,
    );

    expect(summary.byStep.map((step) => step.event)).toEqual([
      "landing_viewed",
      "submitted",
      "app_opened",
      "cta_example",
    ]);
  });

  it("names an event it does not recognise rather than dropping it", () => {
    const summary = summarizeLivePresence([row({ last_event: "retired_event" })], NOW);

    expect(summary.byStep).toEqual([
      { event: "retired_event", label: "retired_event", count: 1, kind: "side" },
    ]);
  });

  // The bug these chips had: a visit whose latest event was a side event was
  // counted in the headline and shown in none of the chips, so the two
  // disagreed - 2 active, one chip reading 1.
  it("splits the active count exactly, arrived and chips together", () => {
    const rows = [
      row({ visit_id: "a", last_event: "landing_viewed" }),
      row({ visit_id: "b", last_event: "cta_example" }),
      row({ visit_id: "c", last_event: "scroll_50" }),
      row({ visit_id: "d", last_event: null }),
      row({ visit_id: "e", last_event: "keeta_opened" }),
      row({ visit_id: "f", last_event: "made_up_event" }),
      // Outside the window: in none of these numbers at all.
      row({ visit_id: "g", last_event: "submitted", last_seen_at: secondsAgo(5 * 60) }),
    ];

    const summary = summarizeLivePresence(rows, NOW);
    const chipped = summary.byStep.reduce((total, step) => total + step.count, 0);

    expect(summary.activeCount).toBe(6);
    expect(summary.arrivedCount + chipped).toBe(summary.activeCount);
  });

  it("reads as empty with no active visits at all", () => {
    const summary = summarizeLivePresence([], NOW);
    expect(summary).toEqual({ activeCount: 0, arrivedCount: 0, byStep: [] });
  });
});
