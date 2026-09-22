import { describe, expect, it } from "vitest";
import { clientKeyFromHeaders } from "@/lib/utils/rate-limit";
import { buildValidationCsv } from "@/lib/admin/export";
import {
  mergeValidationRows,
  type VisitIpRow,
  type VisitSummary,
} from "@/lib/calculations/visits";

/**
 * IP audit trail tests.
 *
 * Tests that IP capture works correctly for validation exports to Keeta.
 */

describe("IP extraction from headers", () => {
  it("extracts the first hop from x-forwarded-for", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.5, 70.41.3.18" });
    const ip = clientKeyFromHeaders(headers);
    expect(ip).toBe("203.0.113.5");
  });

  it("handles x-forwarded-for with spaces", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.5 , 70.41.3.18" });
    const ip = clientKeyFromHeaders(headers);
    expect(ip).toBe("203.0.113.5");
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    const headers = new Headers({ "x-real-ip": "203.0.113.9" });
    const ip = clientKeyFromHeaders(headers);
    expect(ip).toBe("203.0.113.9");
  });

  it("returns 'unknown' when no IP headers present", () => {
    const headers = new Headers();
    const ip = clientKeyFromHeaders(headers);
    expect(ip).toBe("unknown");
  });
});

const ipRow = (
  visit_id: string,
  client_ip: string,
  created_at: string,
  reference?: string,
): VisitIpRow => ({
  visit_id,
  client_ip,
  created_at,
  submissions: reference ? { reference_number: reference } : null,
});

const visit = (visitId: string, over: Partial<VisitSummary> = {}): VisitSummary => ({
  visitId,
  firstSeen: "2026-09-21T12:00:00Z",
  lastSeen: "2026-09-21T12:05:00Z",
  screenshots: 0,
  furthestEvent: null,
  furthestLabel: "—",
  furthestIndex: -1,
  returning: false,
  areaName: null,
  reference: null,
  completed: false,
  utmSource: null,
  utmCampaign: null,
  utmContent: null,
  ...over,
});

/**
 * The question this export exists to answer: was that three people, or one
 * person who tapped the ad three times?
 */
describe("mergeValidationRows", () => {
  it("counts how many visits share one address", () => {
    const rows = mergeValidationRows(
      [
        ipRow("aaaaaaaaaaaaaaaa", "203.0.113.5", "2026-09-21T12:00:00Z"),
        ipRow("bbbbbbbbbbbbbbbb", "203.0.113.5", "2026-09-21T12:04:00Z"),
        ipRow("cccccccccccccccc", "203.0.113.5", "2026-09-21T12:09:00Z"),
        ipRow("dddddddddddddddd", "70.41.3.18", "2026-09-21T12:10:00Z"),
      ],
      [],
    );

    const shared = rows.filter((row) => row.client_ip === "203.0.113.5");
    expect(shared).toHaveLength(3);
    expect(shared.every((row) => row.visits_from_ip === 3)).toBe(true);
    expect(rows.find((row) => row.client_ip === "70.41.3.18")?.visits_from_ip).toBe(1);
  });

  it("puts the busiest address first, with its visits in the order they happened", () => {
    const rows = mergeValidationRows(
      [
        ipRow("dddddddddddddddd", "70.41.3.18", "2026-09-21T12:10:00Z"),
        ipRow("cccccccccccccccc", "203.0.113.5", "2026-09-21T12:09:00Z"),
        ipRow("aaaaaaaaaaaaaaaa", "203.0.113.5", "2026-09-21T12:00:00Z"),
      ],
      [],
    );

    expect(rows.map((row) => row.visit_id)).toEqual([
      "aaaaaaaaaaaaaaaa",
      "cccccccccccccccc",
      "dddddddddddddddd",
    ]);
  });

  it("carries the funnel's view of each visit across", () => {
    const [row] = mergeValidationRows(
      [ipRow("aaaaaaaaaaaaaaaa", "203.0.113.5", "2026-09-21T12:00:00Z")],
      [
        visit("aaaaaaaaaaaaaaaa", {
          screenshots: 2,
          furthestLabel: "Reached the confirm screen",
          areaName: "Dubai Marina",
          utmSource: "instagram",
        }),
      ],
    );

    expect(row.screenshots).toBe(2);
    expect(row.furthest_step).toBe("Reached the confirm screen");
    expect(row.area).toBe("Dubai Marina");
    expect(row.utm_source).toBe("instagram");
  });

  it("keeps a visit that recorded no funnel events rather than dropping it", () => {
    const [row] = mergeValidationRows(
      [ipRow("aaaaaaaaaaaaaaaa", "203.0.113.5", "2026-09-21T12:00:00Z")],
      [],
    );

    expect(row.visit_id).toBe("aaaaaaaaaaaaaaaa");
    expect(row.furthest_step).toBe("—");
    expect(row.screenshots).toBe(0);
    expect(row.converted).toBe(false);
  });

  it("counts an order whichever source recorded it", () => {
    const fromIpTable = mergeValidationRows(
      [ipRow("aaaaaaaaaaaaaaaa", "203.0.113.5", "2026-09-21T12:00:00Z", "SN001")],
      [],
    );
    expect(fromIpTable[0].converted).toBe(true);
    expect(fromIpTable[0].reference_number).toBe("SN001");

    const fromFunnel = mergeValidationRows(
      [ipRow("bbbbbbbbbbbbbbbb", "70.41.3.18", "2026-09-21T12:00:00Z")],
      [visit("bbbbbbbbbbbbbbbb", { reference: "SN002", completed: true })],
    );
    expect(fromFunnel[0].converted).toBe(true);
    expect(fromFunnel[0].reference_number).toBe("SN002");
  });
});

describe("buildValidationCsv", () => {
  it("names every column in the header", () => {
    const [header] = buildValidationCsv([]).split("\r\n");
    expect(header).toContain('"Client IP"');
    expect(header).toContain('"Visits from this IP"');
    expect(header).toContain('"Converted"');
  });

  it("writes the IP and its visit count", () => {
    const csv = buildValidationCsv(
      mergeValidationRows(
        [
          ipRow("aaaaaaaaaaaaaaaa", "203.0.113.5", "2026-09-21T12:00:00Z"),
          ipRow("bbbbbbbbbbbbbbbb", "203.0.113.5", "2026-09-21T12:04:00Z"),
        ],
        [],
      ),
    );

    expect(csv).toContain('"203.0.113.5","2"');
  });

  /**
   * client_ip arrives in a request header, so it is the one value in any of
   * these exports that somebody outside chooses. Excel runs a leading =.
   */
  it("defuses a formula smuggled in through the IP header", () => {
    const csv = buildValidationCsv(
      mergeValidationRows(
        [ipRow("aaaaaaaaaaaaaaaa", '=cmd|"/c calc"!A1', "2026-09-21T12:00:00Z")],
        [],
      ),
    );

    expect(csv).toContain("\"'=cmd|\"\"/c calc\"\"!A1\"");
    expect(csv).not.toContain('"=cmd');
  });
});
