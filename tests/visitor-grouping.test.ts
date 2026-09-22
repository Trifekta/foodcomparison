import { describe, expect, it } from "vitest";
import {
  groupVisitors,
  visitorGroupByVisit,
  type VisitorGroupInput,
} from "@/lib/calculations/visits";

/**
 * Grouping is a reading of the rows, never a change to them.
 *
 * These tests pin the timidity as much as the behaviour: the cost of splitting
 * one person into two is a number everybody already reads around, and the cost
 * of merging two people into one is a report claiming somebody did more than
 * anybody did. Where the evidence runs out, this must split.
 */

const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Instagram 300.0";
const OTHER_UA = "Mozilla/5.0 (Linux; Android 14) Chrome/120";

const at = (minutes: number) =>
  new Date(Date.UTC(2026, 8, 21, 18, minutes, 0)).toISOString();

function visit(over: Partial<VisitorGroupInput> & { visitId: string }): VisitorGroupInput {
  return {
    clientIp: "203.0.113.5",
    userAgent: UA,
    firstSeen: at(0),
    lastSeen: at(0),
    reference: null,
    ...over,
  };
}

describe("groupVisitors", () => {
  it("groups visits sharing an address and a browser, minutes apart", () => {
    const groups = groupVisitors([
      visit({ visitId: "aaaaaaaaaaaaaaaa", firstSeen: at(0), lastSeen: at(1) }),
      visit({ visitId: "bbbbbbbbbbbbbbbb", firstSeen: at(3), lastSeen: at(4) }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].visitIds).toEqual(["aaaaaaaaaaaaaaaa", "bbbbbbbbbbbbbbbb"]);
  });

  it("keeps the seconds-apart case together", () => {
    const groups = groupVisitors([
      visit({ visitId: "aaaaaaaaaaaaaaaa", firstSeen: at(0), lastSeen: at(0) }),
      visit({ visitId: "bbbbbbbbbbbbbbbb", firstSeen: at(0), lastSeen: at(0) }),
      visit({ visitId: "cccccccccccccccc", firstSeen: at(0), lastSeen: at(0) }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].visitIds).toHaveLength(3);
  });

  it("splits the same address once the gap is too long", () => {
    const groups = groupVisitors([
      visit({ visitId: "aaaaaaaaaaaaaaaa", firstSeen: at(0), lastSeen: at(1) }),
      visit({ visitId: "bbbbbbbbbbbbbbbb", firstSeen: at(90), lastSeen: at(91) }),
    ]);

    expect(groups).toHaveLength(2);
  });

  it("measures the gap from where the group ends, not where it started", () => {
    // A chain of short visits, each within half an hour of the last, is one
    // person for as long as it keeps going - not two because the first and
    // last are an hour apart.
    const groups = groupVisitors([
      visit({ visitId: "aaaaaaaaaaaaaaaa", firstSeen: at(0), lastSeen: at(5) }),
      visit({ visitId: "bbbbbbbbbbbbbbbb", firstSeen: at(25), lastSeen: at(30) }),
      visit({ visitId: "cccccccccccccccc", firstSeen: at(50), lastSeen: at(55) }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].visitIds).toHaveLength(3);
  });

  it("never groups across different browsers on one address", () => {
    const groups = groupVisitors([
      visit({ visitId: "aaaaaaaaaaaaaaaa", firstSeen: at(0) }),
      visit({ visitId: "bbbbbbbbbbbbbbbb", firstSeen: at(1), userAgent: OTHER_UA }),
    ]);

    expect(groups).toHaveLength(2);
  });

  it("never groups across different addresses", () => {
    const groups = groupVisitors([
      visit({ visitId: "aaaaaaaaaaaaaaaa", firstSeen: at(0) }),
      visit({ visitId: "bbbbbbbbbbbbbbbb", firstSeen: at(1), clientIp: "70.41.3.18" }),
    ]);

    expect(groups).toHaveLength(2);
  });

  it("never groups two visits that each sent a different order", () => {
    // One office wifi, two colleagues, two carts. The orders outrank every
    // other signal here.
    const groups = groupVisitors([
      visit({ visitId: "aaaaaaaaaaaaaaaa", firstSeen: at(0), reference: "SN001" }),
      visit({ visitId: "bbbbbbbbbbbbbbbb", firstSeen: at(2), reference: "SN002" }),
    ]);

    expect(groups).toHaveLength(2);
  });

  it("still groups when only one of the pair sent an order", () => {
    const groups = groupVisitors([
      visit({ visitId: "aaaaaaaaaaaaaaaa", firstSeen: at(0), reference: null }),
      visit({ visitId: "bbbbbbbbbbbbbbbb", firstSeen: at(2), reference: "SN001" }),
    ]);

    expect(groups).toHaveLength(1);
  });

  it("leaves a visit alone when the browser is unknown", () => {
    // Every row written before 0025 looks like this. Declining to answer is
    // the point: there is no evidence, so there is no group.
    const groups = groupVisitors([
      visit({ visitId: "aaaaaaaaaaaaaaaa", firstSeen: at(0), userAgent: null }),
      visit({ visitId: "bbbbbbbbbbbbbbbb", firstSeen: at(1), userAgent: null }),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups.every((group) => group.visitIds.length === 1)).toBe(true);
  });

  it("leaves a visit alone when the address is unknown", () => {
    const groups = groupVisitors([
      visit({ visitId: "aaaaaaaaaaaaaaaa", firstSeen: at(0), clientIp: null }),
      visit({ visitId: "bbbbbbbbbbbbbbbb", firstSeen: at(1), clientIp: null }),
    ]);

    expect(groups).toHaveLength(2);
  });

  it("splits rather than guessing when a timestamp cannot be read", () => {
    const groups = groupVisitors([
      visit({ visitId: "aaaaaaaaaaaaaaaa", firstSeen: at(0) }),
      visit({ visitId: "bbbbbbbbbbbbbbbb", firstSeen: "not a date" }),
    ]);

    expect(groups).toHaveLength(2);
  });

  it("puts every visit in exactly one group", () => {
    const rows = [
      visit({ visitId: "aaaaaaaaaaaaaaaa", firstSeen: at(0) }),
      visit({ visitId: "bbbbbbbbbbbbbbbb", firstSeen: at(2) }),
      visit({ visitId: "cccccccccccccccc", firstSeen: at(90), clientIp: "70.41.3.18" }),
      visit({ visitId: "dddddddddddddddd", firstSeen: at(95), userAgent: null }),
    ];

    const groups = groupVisitors(rows);
    const placed = groups.flatMap((group) => group.visitIds);

    expect(placed).toHaveLength(rows.length);
    expect(new Set(placed).size).toBe(rows.length);
  });

  it("counts fewer visitors than visits when a person repeats", () => {
    const rows = [
      visit({ visitId: "aaaaaaaaaaaaaaaa", firstSeen: at(0) }),
      visit({ visitId: "bbbbbbbbbbbbbbbb", firstSeen: at(1) }),
      visit({ visitId: "cccccccccccccccc", firstSeen: at(2) }),
    ];

    expect(rows).toHaveLength(3);
    expect(groupVisitors(rows)).toHaveLength(1);
  });

  it("handles an empty range", () => {
    expect(groupVisitors([])).toEqual([]);
  });
});

describe("visitorGroupByVisit", () => {
  it("finds every visit's group", () => {
    const groups = groupVisitors([
      visit({ visitId: "aaaaaaaaaaaaaaaa", firstSeen: at(0) }),
      visit({ visitId: "bbbbbbbbbbbbbbbb", firstSeen: at(1) }),
    ]);

    const index = visitorGroupByVisit(groups);

    expect(index.get("aaaaaaaaaaaaaaaa")).toBe(index.get("bbbbbbbbbbbbbbbb"));
    expect(index.get("aaaaaaaaaaaaaaaa")?.visitIds).toHaveLength(2);
  });
});
