import { describe, expect, it } from "vitest";
import { buildVisitsCsv, visitsCsvFilename } from "@/lib/admin/export";
import { summarizeVisits, type VisitEventRow } from "@/lib/calculations/visits";

const at = (minutesAgo: number) =>
  new Date(Date.parse("2026-09-20T12:00:00Z") - minutesAgo * 60_000).toISOString();

const row = (
  overrides: Partial<VisitEventRow> & Pick<VisitEventRow, "visit_id" | "event">,
): VisitEventRow => ({ created_at: at(0), areas: null, submissions: null, ...overrides });

describe("buildVisitsCsv", () => {
  const csv = buildVisitsCsv(
    summarizeVisits([
      row({ visit_id: "3eb375c0aa11bb22", event: "cart_uploaded", created_at: at(9) }),
      row({ visit_id: "3eb375c0aa11bb22", event: "cart_uploaded", created_at: at(8) }),
      row({
        visit_id: "3eb375c0aa11bb22",
        event: "submitted",
        created_at: at(7),
        areas: { name: "Al Karama" },
        submissions: { reference_number: "K4M2PQ" },
      }),
    ]),
  );

  it("opens as UTF-8 in Excel", () => {
    // Without the byte-order mark Excel guesses the system code page, and an
    // Arabic area name arrives as mojibake.
    expect(csv.startsWith("﻿")).toBe(true);
  });

  it("writes the full visit id, not the shortened one the table shows", () => {
    expect(csv).toContain("3eb375c0aa11bb22");
  });

  it("carries the counts, area, reference and completion", () => {
    const [, first] = csv.split("\r\n");
    expect(first).toContain('"2"');
    expect(first).toContain('"Al Karama"');
    expect(first).toContain('"K4M2PQ"');
    expect(first).toContain('"Yes"');
  });

  it("says No rather than leaving completion blank", () => {
    const stopped = buildVisitsCsv(summarizeVisits([row({ visit_id: "a", event: "wizard_started" })]));
    expect(stopped.split("\r\n")[1]).toContain('"No"');
  });

  it("writes an empty cell rather than the table's em dash for an unknown step", () => {
    const unknown = buildVisitsCsv(summarizeVisits([row({ visit_id: "a", event: "mystery" })]));
    expect(unknown).not.toContain("—");
  });

  it("still produces a header row with no visits at all", () => {
    expect(buildVisitsCsv([]).trim()).toContain('"Visit"');
  });

  /** A field that starts with = is a formula to Excel, not text. */
  it("defuses a value a spreadsheet would otherwise run", () => {
    const risky = buildVisitsCsv(
      summarizeVisits([
        row({ visit_id: "a", event: "submitted", areas: { name: "=1+1" } }),
      ]),
    );
    expect(risky).toContain("'=1+1");
  });
});

describe("visitsCsvFilename", () => {
  it("names the window it covers", () => {
    expect(visitsCsvFilename({ from: "2026-09-20", to: "2026-09-20" })).toBe(
      "snipsavor-visits-2026-09-20-to-2026-09-20.csv",
    );
  });

  it("says today when no range was chosen, matching the page default", () => {
    expect(visitsCsvFilename({})).toBe("snipsavor-visits-today.csv");
  });

  it("records the step, so two filtered downloads do not collide", () => {
    expect(visitsCsvFilename({}, "cart_uploaded")).toBe(
      "snipsavor-visits-today-cart_uploaded.csv",
    );
  });
});
