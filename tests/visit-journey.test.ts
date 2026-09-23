import { describe, expect, it } from "vitest";
import {
  INACTIVITY_MS,
  describeJourney,
  summarizeVisits,
  topPaths,
  visitOutcome,
  type VisitEventRow,
} from "@/lib/calculations/visits";

/**
 * What became of a visit, derived rather than recorded.
 *
 * The property these tests exist to protect: nothing here is stored. A visit
 * called abandoned at 14:05 and seen again at 14:40 recomputes as active the
 * next time anybody looks, with no row to correct. An event written at
 * departure could not do that - it would be a verdict, and verdicts are wrong
 * as soon as somebody comes back.
 */

const T0 = Date.UTC(2026, 8, 22, 18, 0, 0);
const at = (secondsIn: number) => new Date(T0 + secondsIn * 1000).toISOString();

function event(visit_id: string, name: string, secondsIn: number): VisitEventRow {
  return {
    visit_id,
    event: name,
    created_at: at(secondsIn),
    areas: null,
    submissions: null,
  };
}

/** One visit's events, newest first - the order the query actually returns. */
function visitFrom(names: [string, number][]) {
  const rows = names.map(([name, seconds]) => event("aaaaaaaaaaaaaaaa", name, seconds));
  return summarizeVisits([...rows].reverse())[0];
}

describe("summarizeVisits path", () => {
  it("reads the path in time order however the rows arrive", () => {
    const visit = visitFrom([
      ["wizard_started", 0],
      ["fork_need_to_take", 10],
      ["app_opened", 20],
    ]);

    expect(visit.path).toEqual(["wizard_started", "fork_need_to_take", "app_opened"]);
    expect(visit.lastEvent).toBe("app_opened");
  });

  it("collapses a retry into one step but still counts it", () => {
    const visit = visitFrom([
      ["wizard_started", 0],
      ["cart_uploaded", 10],
      ["cart_uploaded", 20],
      ["cart_uploaded", 30],
    ]);

    expect(visit.path).toEqual(["wizard_started", "cart_uploaded"]);
    expect(visit.screenshots).toBe(3);
  });

  it("keeps the same event twice when something happened in between", () => {
    // Uploaded, went to fetch a better screenshot, uploaded again. Two moves
    // in the story, not one.
    const visit = visitFrom([
      ["cart_uploaded", 0],
      ["app_opened", 10],
      ["returned_from_app", 20],
      ["cart_uploaded", 30],
    ]);

    expect(visit.path).toEqual([
      "cart_uploaded",
      "app_opened",
      "returned_from_app",
      "cart_uploaded",
    ]);
  });

  it("separates the last event from the furthest step", () => {
    // app_opened is a detour, not a rung: the furthest RUNG is still the
    // upload screen, while the last thing they did was leave for an app.
    const visit = visitFrom([
      ["wizard_started", 0],
      ["app_opened", 10],
    ]);

    expect(visit.furthestEvent).toBe("wizard_started");
    expect(visit.lastEvent).toBe("app_opened");
  });
});

describe("visitOutcome", () => {
  const started = visitFrom([["wizard_started", 0]]);

  it("calls a recent visit active", () => {
    const now = T0 + 60_000;
    expect(visitOutcome(started, new Date(now - 30_000).toISOString(), now)).toBe("active");
  });

  it("calls a quiet visit that never uploaded abandoned", () => {
    const now = T0 + INACTIVITY_MS + 60_000;
    expect(visitOutcome(started, at(0), now)).toBe("abandoned");
  });

  it("never calls a completed visit anything else", () => {
    const sent = visitFrom([
      ["wizard_started", 0],
      ["cart_uploaded", 10],
      ["submitted", 20],
    ]);
    const now = T0 + INACTIVITY_MS * 10;

    expect(visitOutcome(sent, at(20), now)).toBe("completed");
  });

  /**
   * The rule the whole design turns on: being at a food app is the flow
   * working, not the flow failing, however long it has been quiet.
   */
  it("never calls somebody away at a food app abandoned", () => {
    const away = visitFrom([
      ["wizard_started", 0],
      ["fork_need_to_take", 10],
      ["app_opened", 20],
    ]);
    const now = T0 + INACTIVITY_MS * 4;

    expect(visitOutcome(away, at(20), now)).toBe("at_food_app");
  });

  it("judges them on what they did once they are back", () => {
    const back = visitFrom([
      ["wizard_started", 0],
      ["app_opened", 10],
      ["returned_from_app", 20],
    ]);
    const now = T0 + INACTIVITY_MS * 4;

    // Back, then quiet, and still no screenshot. That is a real loss and the
    // food-app exemption no longer covers it.
    expect(visitOutcome(back, at(20), now)).toBe("abandoned");
  });

  it("does not call somebody who uploaded abandoned", () => {
    const uploaded = visitFrom([
      ["wizard_started", 0],
      ["cart_uploaded", 10],
    ]);
    const now = T0 + INACTIVITY_MS * 2;

    expect(visitOutcome(uploaded, at(10), now)).toBe("idle");
  });

  /**
   * The heartbeat is the point of taking last_seen_at at all: somebody
   * reading the screen records no events, so their last EVENT is old while
   * they are still looking at it.
   */
  it("believes the heartbeat over the last event", () => {
    const now = T0 + INACTIVITY_MS * 2;
    const heartbeatJustNow = new Date(now - 10_000).toISOString();

    expect(visitOutcome(started, heartbeatJustNow, now)).toBe("active");
    expect(visitOutcome(started, null, now)).toBe("abandoned");
  });

  it("recomputes rather than remembering when somebody comes back", () => {
    const now = T0 + INACTIVITY_MS * 2;
    expect(visitOutcome(started, at(0), now)).toBe("abandoned");

    // Same visit, same function, later heartbeat. No stored verdict to undo.
    const later = now + 60_000;
    expect(visitOutcome(started, new Date(later - 5_000).toISOString(), later)).toBe("active");
  });
});

describe("describeJourney", () => {
  it("ends the sentence with what became of the visit", () => {
    const visit = visitFrom([
      ["wizard_started", 0],
      ["fork_need_to_take", 10],
      ["app_opened", 20],
      ["returned_from_app", 30],
      ["cart_uploaded", 40],
    ]);

    expect(describeJourney(visit, "abandoned")).toEqual([
      "Opened wizard",
      "Need to take one",
      "Food app",
      "Returned",
      "Uploaded",
      "Left",
    ]);
  });

  it("does not add an ending to a completed visit", () => {
    const visit = visitFrom([
      ["cart_uploaded", 0],
      ["submitted", 10],
    ]);

    expect(describeJourney(visit, "completed")).toEqual(["Uploaded", "Sent"]);
  });

  it("reads the fork-and-leave case the survey was meant to explain", () => {
    const visit = visitFrom([
      ["wizard_started", 0],
      ["fork_have_screenshot", 10],
      ["scroll_100", 20],
    ]);

    expect(describeJourney(visit, "abandoned")).toEqual([
      "Opened wizard",
      "Have a screenshot",
      "Reached bottom",
      "Left",
    ]);
  });

  it("survives a visit with no events", () => {
    const visit = visitFrom([["wizard_started", 0]]);
    expect(describeJourney({ ...visit, path: [] }, "idle")).toEqual(["Stopped"]);
  });
});

describe("topPaths", () => {
  it("counts identical journeys together, commonest first", () => {
    const paths = topPaths([
      { steps: ["Opened wizard", "Left"], completed: false },
      { steps: ["Opened wizard", "Uploaded", "Sent"], completed: true },
      { steps: ["Opened wizard", "Left"], completed: false },
      { steps: ["Opened wizard", "Left"], completed: false },
    ]);

    expect(paths[0].steps).toEqual(["Opened wizard", "Left"]);
    expect(paths[0].visits).toBe(3);
    expect(paths[0].completed).toBe(0);
    expect(paths[1].visits).toBe(1);
    expect(paths[1].completed).toBe(1);
  });

  it("keeps journeys with the same steps in a different order apart", () => {
    const paths = topPaths([
      { steps: ["Uploaded", "Food app"], completed: false },
      { steps: ["Food app", "Uploaded"], completed: false },
    ]);

    expect(paths).toHaveLength(2);
  });

  it("orders equal counts the same way twice", () => {
    const rows = [
      { steps: ["B", "Left"], completed: false },
      { steps: ["A", "Left"], completed: false },
    ];

    expect(topPaths(rows).map((p) => p.steps[0])).toEqual(topPaths(rows).map((p) => p.steps[0]));
  });

  it("handles an empty range", () => {
    expect(topPaths([])).toEqual([]);
  });
});
