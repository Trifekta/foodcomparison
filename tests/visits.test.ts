import { describe, expect, it } from "vitest";
import {
  filterByStep,
  isStepMatch,
  summarizeVisits,
  totalVisits,
  type VisitEventRow,
} from "@/lib/calculations/visits";

const at = (minutesAgo: number) =>
  new Date(Date.parse("2026-09-20T12:00:00Z") - minutesAgo * 60_000).toISOString();

const row = (overrides: Partial<VisitEventRow> & Pick<VisitEventRow, "visit_id" | "event">): VisitEventRow => ({
  created_at: at(0),
  areas: null,
  submissions: null,
  ...overrides,
});

describe("summarizeVisits", () => {
  it("collapses a visit's events into one row", () => {
    const visits = summarizeVisits([
      row({ visit_id: "a", event: "landing_viewed", created_at: at(10) }),
      row({ visit_id: "a", event: "wizard_started", created_at: at(9) }),
      row({ visit_id: "a", event: "cart_uploaded", created_at: at(8) }),
    ]);

    expect(visits).toHaveLength(1);
    expect(visits[0].visitId).toBe("a");
    expect(visits[0].firstSeen).toBe(at(10));
    expect(visits[0].lastSeen).toBe(at(8));
  });

  /** The question this file exists for: retries are the friction signal. */
  it("counts every screenshot a visit picked, retries included", () => {
    const visits = summarizeVisits([
      row({ visit_id: "a", event: "cart_uploaded", created_at: at(9) }),
      row({ visit_id: "a", event: "cart_uploaded", created_at: at(8) }),
      row({ visit_id: "a", event: "cart_uploaded", created_at: at(7) }),
    ]);
    expect(visits[0].screenshots).toBe(3);
  });

  it("reports the furthest step by funnel order, not by arrival order", () => {
    // Recorded out of order on purpose - a later row that is an earlier step
    // must not drag the furthest point backwards.
    const visits = summarizeVisits([
      row({ visit_id: "a", event: "step_review", created_at: at(9) }),
      row({ visit_id: "a", event: "wizard_started", created_at: at(1) }),
    ]);
    expect(visits[0].furthestEvent).toBe("step_review");
    expect(visits[0].furthestLabel).toBe("Gave area and total");
  });

  it("marks a visit completed only once it sent the order", () => {
    const stopped = summarizeVisits([row({ visit_id: "a", event: "step_review" })]);
    expect(stopped[0].completed).toBe(false);

    const sent = summarizeVisits([
      row({ visit_id: "b", event: "step_review", created_at: at(2) }),
      row({ visit_id: "b", event: "submitted", created_at: at(1) }),
    ]);
    expect(sent[0].completed).toBe(true);
  });

  /**
   * The bug this guards: a customer opens the WhatsApp result link the next
   * day. That is a new visit id whose only events are result_viewed (and maybe
   * keeta_opened), both of which outrank "submitted" in FUNNEL_STEPS - so the
   * day's Completed total counted yesterday's orders as today's.
   */
  it("does not count a visit that only came back to an earlier order", () => {
    const visits = summarizeVisits([
      row({ visit_id: "a", event: "result_viewed", created_at: at(9) }),
      row({ visit_id: "a", event: "keeta_opened", created_at: at(8) }),
    ]);

    expect(visits[0].completed).toBe(false);
    expect(visits[0].returning).toBe(true);
    // It still reached what it reached - that part was never wrong.
    expect(visits[0].furthestEvent).toBe("keeta_opened");
  });

  it("still counts a visit that sent the order and read its result in one go", () => {
    const visits = summarizeVisits([
      row({ visit_id: "a", event: "submitted", created_at: at(9) }),
      row({ visit_id: "a", event: "result_viewed", created_at: at(8) }),
    ]);

    expect(visits[0].completed).toBe(true);
    expect(visits[0].returning).toBe(false);
  });

  it("resolves the area and reference from whichever event carries one", () => {
    const visits = summarizeVisits([
      row({ visit_id: "a", event: "wizard_started", created_at: at(9) }),
      row({ visit_id: "a", event: "step_review", created_at: at(8), areas: { name: "Al Karama" } }),
      row({
        visit_id: "a",
        event: "submitted",
        created_at: at(7),
        submissions: { reference_number: "K4M2PQ" },
      }),
    ]);
    expect(visits[0].areaName).toBe("Al Karama");
    expect(visits[0].reference).toBe("K4M2PQ");
  });

  it("keeps visits apart and puts the most recent first", () => {
    const visits = summarizeVisits([
      row({ visit_id: "old", event: "wizard_started", created_at: at(30) }),
      row({ visit_id: "new", event: "wizard_started", created_at: at(2) }),
    ]);
    expect(visits.map((visit) => visit.visitId)).toEqual(["new", "old"]);
  });

  it("survives an event name the funnel does not know", () => {
    const visits = summarizeVisits([row({ visit_id: "a", event: "something_else" })]);
    expect(visits[0].furthestIndex).toBe(-1);
    expect(visits[0].furthestLabel).toBe("—");
    expect(visits[0].completed).toBe(false);
  });
});

describe("totalVisits", () => {
  it("counts visits, uploaders, completions and total screenshots separately", () => {
    const totals = totalVisits(
      summarizeVisits([
        row({ visit_id: "a", event: "cart_uploaded", created_at: at(9) }),
        row({ visit_id: "a", event: "cart_uploaded", created_at: at(8) }),
        row({ visit_id: "a", event: "submitted", created_at: at(7) }),
        row({ visit_id: "b", event: "cart_uploaded", created_at: at(6) }),
        row({ visit_id: "c", event: "landing_viewed", created_at: at(5) }),
      ]),
    );

    expect(totals).toEqual({ visits: 3, uploaded: 2, completed: 1, screenshots: 3 });
  });

  it("counts a returning result-reader as a visit but not as a completion", () => {
    const totals = totalVisits(
      summarizeVisits([
        row({ visit_id: "sent-today", event: "submitted", created_at: at(9) }),
        row({ visit_id: "read-yesterdays", event: "result_viewed", created_at: at(5) }),
      ]),
    );

    expect(totals.visits).toBe(2);
    expect(totals.completed).toBe(1);
  });
});

describe("filterByStep", () => {
  const visits = summarizeVisits([
    row({ visit_id: "landed", event: "landing_viewed" }),
    row({ visit_id: "uploaded", event: "cart_uploaded" }),
    row({ visit_id: "sent", event: "submitted" }),
  ]);

  it("keeps everything when no step is chosen", () => {
    expect(filterByStep(visits, null)).toHaveLength(3);
  });

  it("keeps the visits that got at least that far", () => {
    const reached = filterByStep(visits, "cart_uploaded").map((visit) => visit.visitId);
    expect(reached).toContain("uploaded");
    expect(reached).toContain("sent");
    expect(reached).not.toContain("landed");
  });

  it("leaves a returning result-reader out of the steps it never walked", () => {
    const returning = summarizeVisits([row({ visit_id: "came-back", event: "result_viewed" })]);

    expect(filterByStep(returning, "submitted", "reached")).toHaveLength(0);
    expect(filterByStep(returning, "wizard_started", "reached")).toHaveLength(0);
    // The one step it really did reach still finds it.
    expect(filterByStep(returning, "result_viewed", "reached")).toHaveLength(1);
  });

  it("ignores a step it does not recognise rather than emptying the table", () => {
    expect(filterByStep(visits, "not_a_step")).toHaveLength(3);
  });

  /**
   * The reason this mode exists: asking for "got at least as far as the
   * wizard" and being shown somebody who went on to send an order is correct
   * and reads as a bug, so the other question had to become askable.
   */
  it("keeps only the visits that stopped on that exact step", () => {
    const stopped = filterByStep(visits, "cart_uploaded", "stopped").map((v) => v.visitId);
    expect(stopped).toEqual(["uploaded"]);
  });

  it("asks a different question from reached, on the same step", () => {
    expect(filterByStep(visits, "landing_viewed", "reached")).toHaveLength(3);
    expect(filterByStep(visits, "landing_viewed", "stopped")).toHaveLength(1);
  });

  it("defaults to reached when no mode is given", () => {
    expect(filterByStep(visits, "cart_uploaded")).toHaveLength(
      filterByStep(visits, "cart_uploaded", "reached").length,
    );
  });

  it("still ignores an unknown step under stopped", () => {
    expect(filterByStep(visits, "not_a_step", "stopped")).toHaveLength(3);
  });
});

describe("isStepMatch", () => {
  it("accepts the two modes and refuses anything else", () => {
    expect(isStepMatch("reached")).toBe(true);
    expect(isStepMatch("stopped")).toBe(true);
    expect(isStepMatch("everything")).toBe(false);
    expect(isStepMatch(null)).toBe(false);
  });
});

describe("VisitsTable row cap", () => {
  /**
   * Not a rendering test - a statement about the contract the cap relies on.
   * The table slices the list it is given; the totals are computed before that
   * slice, so capping what is listed must never change what is counted.
   */
  it("totals are computed over every visit, not the listed ones", () => {
    const rows: VisitEventRow[] = [];
    for (let i = 0; i < 250; i += 1) {
      rows.push(row({ visit_id: `v${i}`, event: "cart_uploaded", created_at: at(i) }));
    }
    const summaries = summarizeVisits(rows);
    expect(summaries).toHaveLength(250);
    expect(totalVisits(summaries).screenshots).toBe(250);
    expect(totalVisits(summaries.slice(0, 200)).screenshots).toBe(200);
  });
});
