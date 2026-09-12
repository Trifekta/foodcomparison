import { describe, expect, it } from "vitest";
import {
  buildReportCsv,
  buildSubmissionsCsv,
  formatDubaiTimestamp,
  reportCsvFilename,
  submissionsCsvFilename,
} from "@/lib/admin/export";
import {
  filtersToQueryString,
  parseDateRange,
  parseSubmissionFilters,
  rangeToQueryString,
} from "@/lib/admin/filters";
import { rangeToInstants } from "@/lib/admin/queries";
import { computeValidationMetrics } from "@/lib/calculations/analytics";
import { computeFunnel } from "@/lib/analytics/funnel";
import type { SubmissionListRow } from "@/lib/admin/queries";

function row(overrides: Partial<SubmissionListRow> = {}): SubmissionListRow {
  return {
    id: "0d2c6d5a-1a1a-4f4f-9a9a-2b2b2b2b2b2b",
    reference_number: "K7M2PQ",
    created_at: "2026-09-11T18:55:00.000Z",
    status: "result_ready",
    source_app: "Talabat",
    source_app_other: null,
    current_total: "85.69",
    comparison_total: "73.00",
    saving_amount: "12.69",
    saving_percentage: "14.81",
    contact_type: "whatsapp",
    area_id: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
    archived_at: null,
    areas: { id: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa", name: "Al Karama" },
    ...overrides,
  };
}

describe("the CSV Excel has to be able to open", () => {
  it("starts with a byte-order mark, or Arabic arrives as mojibake", () => {
    expect(buildSubmissionsCsv([])).toMatch(/^﻿/);
  });

  it("quotes every field, because area names contain commas", () => {
    const csv = buildSubmissionsCsv([row({ areas: { id: "x", name: "Al Karama, Block B" } })]);
    expect(csv).toContain('"Al Karama, Block B"');
    // The comma inside the name must not have become a column break: the row
    // still has exactly as many separators as the header.
    const [header, body] = csv.replace(/^﻿/, "").split("\r\n");
    const separators = (line: string) => line.split('","').length;
    expect(separators(body)).toBe(separators(header));
  });

  it("doubles a quote inside a value rather than ending the field", () => {
    const csv = buildSubmissionsCsv([row({ areas: { id: "x", name: 'The "Old" Town' } })]);
    expect(csv).toContain('"The ""Old"" Town"');
  });

  /**
   * A field beginning with = is a formula to a spreadsheet, not text. Area
   * names are typed by an admin, so this is reachable.
   */
  it("defuses a value a spreadsheet would otherwise run", () => {
    const csv = buildSubmissionsCsv([row({ areas: { id: "x", name: "=1+1" } })]);
    expect(csv).toContain(`"'=1+1"`);
    expect(csv).not.toContain('"=1+1"');
  });

  it("says whether a row is archived", () => {
    expect(buildSubmissionsCsv([row()])).toContain('"No"');
    expect(buildSubmissionsCsv([row({ archived_at: "2026-09-12T06:00:00Z" })])).toContain('"Yes"');
  });

  it("leaves the comparison columns empty when nobody has priced it yet", () => {
    const csv = buildSubmissionsCsv([
      row({ comparison_total: null, saving_amount: null, saving_percentage: null }),
    ]);
    const body = csv.replace(/^﻿/, "").split("\r\n")[1];
    expect(body).toContain('"","",""');
  });

  it("writes a header even with no rows, so the file is still a table", () => {
    const csv = buildSubmissionsCsv([]);
    expect(csv).toContain('"Reference"');
    expect(csv.replace(/^﻿/, "").trim().split("\r\n")).toHaveLength(1);
  });
});

describe("timestamps as Dubai reads them", () => {
  it("adds the four-hour offset", () => {
    // 18:55 UTC is 22:55 in Dubai, the same day.
    expect(formatDubaiTimestamp("2026-09-11T18:55:00.000Z")).toBe("2026-09-11 22:55");
  });

  it("rolls over the date after 20:00 UTC", () => {
    expect(formatDubaiTimestamp("2026-09-11T21:30:00.000Z")).toBe("2026-09-12 01:30");
  });

  it("returns nothing for an unparseable timestamp instead of NaN", () => {
    expect(formatDubaiTimestamp("not a date")).toBe("");
  });

  it("names the file by the Dubai date", () => {
    expect(submissionsCsvFilename(new Date("2026-09-11T21:30:00.000Z"))).toBe(
      "snipsavor-submissions-2026-09-12.csv",
    );
  });
});

describe("the filters the table and the export share", () => {
  it("defaults to the working list", () => {
    expect(parseSubmissionFilters({}).archived).toBe("active");
  });

  it("does not widen the view on a typo", () => {
    expect(parseSubmissionFilters({ archived: "everything" }).archived).toBe("active");
  });

  it.each(["active", "archived", "all"] as const)("accepts %s", (view) => {
    expect(parseSubmissionFilters({ archived: view }).archived).toBe(view);
  });

  it("ignores a status it does not recognise", () => {
    expect(parseSubmissionFilters({ status: "deleted" }).status).toBe("all");
    expect(parseSubmissionFilters({ status: "result_sent" }).status).toBe("result_sent");
  });

  it("takes the first value when a param is repeated", () => {
    expect(parseSubmissionFilters({ search: ["K7M2PQ", "other"] }).search).toBe("K7M2PQ");
  });

  it("treats whitespace as absent", () => {
    expect(parseSubmissionFilters({ search: "   " }).search).toBeUndefined();
  });

  /**
   * The round trip is the point: the export link is built from the parsed
   * filters, and the route parses it again. If those two disagree the file
   * holds different rows from the table it came from.
   */
  it("survives a round trip through the query string", () => {
    const params = {
      status: "result_sent",
      archived: "all",
      area: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
      app: "Talabat",
      from: "2026-09-01",
      to: "2026-09-30",
      search: "K7M2PQ",
    };
    const first = parseSubmissionFilters(params);
    const query = filtersToQueryString(first);
    const second = parseSubmissionFilters(Object.fromEntries(new URLSearchParams(query)));
    expect(second).toEqual(first);
  });

  it("leaves the defaults out of the query string", () => {
    expect(filtersToQueryString(parseSubmissionFilters({}))).toBe("");
  });
});

describe("the report, and the range it covers", () => {
  const metrics = computeValidationMetrics([
    {
      status: "result_sent",
      source_app: "Talabat",
      current_total: "85.69",
      comparison_total: "73.00",
      saving_amount: "12.69",
      restaurant_name: "Al Safadi",
      unavailable_reason: null,
      areas: { name: "Al Karama" },
    },
  ]);

  const funnel = computeFunnel([
    { event: "landing_viewed", visit_id: "a" },
    { event: "landing_viewed", visit_id: "b" },
    { event: "wizard_started", visit_id: "a" },
  ]);

  it("says what range it covers, because a forwarded report without one is wrong", () => {
    expect(buildReportCsv(metrics, funnel, { from: "2026-09-01", to: "2026-09-12" })).toContain(
      '"2026-09-01 to 2026-09-12"',
    );
    expect(buildReportCsv(metrics, funnel, {})).toContain('"All time"');
  });

  it("carries the headline numbers and the funnel in one file", () => {
    const csv = buildReportCsv(metrics, funnel, {});
    expect(csv).toContain('"Submissions","1"');
    expect(csv).toContain('"Customer funnel (counted by visit, not by person)"');
    expect(csv).toContain('"Landed from the advert","2"');
    // Half of the people who landed went on to open the wizard.
    expect(csv).toContain('"Opened the wizard","1","50.0%","50.0%"');
  });

  it("keeps the spreadsheet defences the submissions export has", () => {
    const csv = buildReportCsv(metrics, funnel, {});
    expect(csv).toMatch(/^﻿/);
    expect(csv).toContain('"Al Karama","1"');
  });

  it("names the file after the range", () => {
    expect(reportCsvFilename({ from: "2026-09-01", to: "2026-09-12" })).toBe(
      "snipsavor-report-2026-09-01-to-2026-09-12.csv",
    );
    expect(reportCsvFilename({}, new Date("2026-09-11T21:30:00Z"))).toBe(
      "snipsavor-report-all-time-2026-09-12.csv",
    );
  });
});

describe("reading a date range off the URL", () => {
  it("takes a pair of calendar dates", () => {
    expect(parseDateRange({ from: "2026-09-01", to: "2026-09-12" })).toEqual({
      from: "2026-09-01",
      to: "2026-09-12",
    });
  });

  it("drops anything that is not a date, rather than sending it to Postgres", () => {
    expect(parseDateRange({ from: "last tuesday", to: "2026-09-12" })).toEqual({
      to: "2026-09-12",
    });
    expect(parseDateRange({})).toEqual({});
  });

  /** Typing them the wrong way round should not silently produce nothing. */
  it("swaps a backwards range into the one they meant", () => {
    expect(parseDateRange({ from: "2026-09-12", to: "2026-09-01" })).toEqual({
      from: "2026-09-01",
      to: "2026-09-12",
    });
  });

  it("turns a range into the same two parameters the page uses", () => {
    expect(rangeToQueryString({ from: "2026-09-01", to: "2026-09-12" })).toBe(
      "from=2026-09-01&to=2026-09-12",
    );
    expect(rangeToQueryString({})).toBe("");
  });

  /** Dubai is UTC+4, so a day has to start and end four hours early in UTC. */
  it("bounds a day in Dubai time, not UTC", () => {
    expect(rangeToInstants({ from: "2026-09-01", to: "2026-09-01" })).toEqual({
      since: "2026-09-01T00:00:00+04:00",
      until: "2026-09-01T23:59:59+04:00",
    });
  });
});
