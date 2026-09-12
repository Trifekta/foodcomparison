import type { SubmissionListRow, DateRange } from "./queries";
import type { ValidationMetrics } from "@/lib/calculations/analytics";
import {
  AREA_FUNNEL_STEPS,
  type AreaFunnelCount,
  type FunnelStepCount,
} from "@/lib/analytics/funnel";
import { formatDecimalStringAsCurrency, formatMinorAsCurrency } from "@/lib/calculations/money";
import { STATUS_LABELS } from "@/lib/utils/status";

/**
 * The submission list as a spreadsheet.
 *
 * CSV rather than a real .xlsx. Excel opens both, and the writer libraries that
 * produce a genuine workbook are around a megabyte - which this app cannot
 * spend, because the whole Worker is measured against a limit and the OCR
 * assets already take the room. A file that opens correctly costs nothing here;
 * one that adds a megabyte to every cold start costs it on every visit.
 *
 * Two details that decide whether Excel reads it properly:
 *
 *  - A byte-order mark. Without one Excel assumes the system code page, and
 *    "Al Karama" survives that while an Arabic restaurant name does not.
 *  - Every field quoted. Area names contain commas, and a total that slips into
 *    the next column is worse than no export.
 */

/** Columns, in the order they are read. */
const HEADERS = [
  "Reference",
  "Created (Dubai)",
  "Status",
  "Archived",
  "Area",
  "Ordered from",
  "Customer total",
  "Comparison total",
  "Saving",
  "Saving %",
  "Contact method",
] as const;

/**
 * Neutralises a value a spreadsheet would otherwise run.
 *
 * Excel treats a leading =, +, - or @ as the start of a formula, so a field
 * that happens to begin with one stops being text and becomes something the
 * spreadsheet executes. An apostrophe in front makes it a string again.
 */
function defuse(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

/** One CSV field: quoted, with internal quotes doubled. */
function field(value: string | null | undefined): string {
  const text = defuse(String(value ?? "").replace(/\r?\n/g, " ").trim());
  return `"${text.replace(/"/g, '""')}"`;
}

/**
 * The timestamp as the person reading it experiences it.
 *
 * Dubai is UTC+4 all year - no daylight saving - so the offset is a constant
 * rather than a timezone database. An ISO string in UTC would be correct and
 * would still have somebody doing the arithmetic in their head.
 */
export function formatDubaiTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const dubai = new Date(date.getTime() + 4 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${dubai.getUTCFullYear()}-${pad(dubai.getUTCMonth() + 1)}-${pad(dubai.getUTCDate())}` +
    ` ${pad(dubai.getUTCHours())}:${pad(dubai.getUTCMinutes())}`
  );
}

export function buildSubmissionsCsv(rows: SubmissionListRow[]): string {
  const lines = [HEADERS.map(field).join(",")];

  for (const row of rows) {
    lines.push(
      [
        field(row.reference_number),
        field(formatDubaiTimestamp(row.created_at)),
        field(STATUS_LABELS[row.status] ?? row.status),
        field(row.archived_at ? "Yes" : "No"),
        field(row.areas?.name ?? ""),
        field(row.source_app_other?.trim() || row.source_app),
        field(formatDecimalStringAsCurrency(row.current_total) ?? row.current_total),
        field(
          row.comparison_total
            ? (formatDecimalStringAsCurrency(row.comparison_total) ?? row.comparison_total)
            : "",
        ),
        field(
          row.saving_amount
            ? (formatDecimalStringAsCurrency(row.saving_amount) ?? row.saving_amount)
            : "",
        ),
        field(row.saving_percentage ? `${Number(row.saving_percentage).toFixed(1)}%` : ""),
        field(row.contact_type === "whatsapp" ? "WhatsApp" : "Email"),
      ].join(","),
    );
  }

  // CRLF, which is what every spreadsheet expects of a CSV.
  return `﻿${lines.join("\r\n")}\r\n`;
}

/** A filename that sorts by date and says what it is. */
export function submissionsCsvFilename(now = new Date()): string {
  const dubai = new Date(now.getTime() + 4 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${dubai.getUTCFullYear()}-${pad(dubai.getUTCMonth() + 1)}-${pad(dubai.getUTCDate())}`;
  return `snipsavor-submissions-${stamp}.csv`;
}


/**
 * The Validation page as a file.
 *
 * One CSV with labelled sections rather than several files. A spreadsheet has
 * no idea what a section is, but a person opening it does - and "one download"
 * is what was asked for. Each block keeps its own header row so the columns
 * underneath it still mean something.
 *
 * The range is printed at the top. A report that does not say what it covers
 * becomes wrong the moment it is forwarded.
 */
export function buildReportCsv(
  metrics: ValidationMetrics,
  funnel: FunnelStepCount[],
  range: DateRange,
  areaFunnel: AreaFunnelCount[] = [],
): string {
  const rows: string[][] = [];
  const blank = () => rows.push([""]);

  rows.push(["SnipSavor report"]);
  rows.push([
    "Range",
    range.from || range.to
      ? `${range.from ?? "the beginning"} to ${range.to ?? "today"}`
      : "All time",
  ]);
  rows.push(["Generated (Dubai)", formatDubaiTimestamp(new Date().toISOString())]);
  blank();

  rows.push(["Headline"]);
  rows.push(["Metric", "Value"]);
  rows.push(["Submissions", String(metrics.totalSubmissions)]);
  rows.push(["Comparisons completed", String(metrics.completedComparisons)]);
  rows.push(["Saving found", String(metrics.savingFoundCount)]);
  rows.push(["Saving found %", `${metrics.savingFoundPercentage.toFixed(1)}%`]);
  rows.push(["No saving %", `${metrics.noSavingPercentage.toFixed(1)}%`]);
  rows.push(["Average saving", formatMinorAsCurrency(metrics.averageSavingMinor)]);
  rows.push(["Average saving %", `${metrics.averageSavingPercentage.toFixed(1)}%`]);
  rows.push(["Couldn't compare", String(metrics.unavailableCount)]);
  rows.push(["Couldn't compare %", `${metrics.unavailablePercentage.toFixed(1)}%`]);
  blank();

  // The funnel is the reason the range exists, so it comes before the slices.
  rows.push(["Customer funnel (counted by visit, not by person)"]);
  rows.push(["Step", "Visits", "Share of first step %", "Drop from previous %"]);
  for (const step of funnel) {
    rows.push([
      step.label,
      String(step.count),
      `${step.shareOfStart.toFixed(1)}%`,
      `${step.dropFromPrevious.toFixed(1)}%`,
    ]);
  }
  blank();

  // Where the funnel and the areas meet, which is the actionable half: an area
  // people reach the total step from and then abandon is a different problem
  // from an area nobody arrives from at all.
  rows.push(["How far visits got, by area"]);
  rows.push([
    "Area",
    ...AREA_FUNNEL_STEPS.map((step) => step.label),
    "Reached Keeta %",
  ]);
  if (areaFunnel.length === 0) {
    rows.push(["(nobody has reached the area step in this range)"]);
  }
  for (const area of areaFunnel) {
    rows.push([
      area.area,
      ...area.counts.map(String),
      `${area.conversion.toFixed(1)}%`,
    ]);
  }
  blank();

  const section = (title: string, header: string, counts: { label: string; count: number }[]) => {
    rows.push([title]);
    rows.push([header, "Submissions"]);
    if (counts.length === 0) rows.push(["(none)", "0"]);
    for (const entry of counts) rows.push([entry.label, String(entry.count)]);
    blank();
  };

  section("By area", "Area", metrics.byArea);
  section("By app the order came from", "App", metrics.bySourceApp);
  section("Why we couldn't compare", "Reason", metrics.unavailableByReason);
  section("Restaurants not on the comparison app", "Restaurant", metrics.unavailableRestaurants);

  rows.push(["Saving distribution"]);
  rows.push(["Band", "Comparisons"]);
  for (const bucket of metrics.savingDistribution) {
    rows.push([bucket.label, String(bucket.count)]);
  }

  const body = rows.map((cells) => cells.map(field).join(",")).join("\r\n");
  return `\ufeff${body}\r\n`;
}

/** Names the file by the range it covers, so downloads do not collide. */
export function reportCsvFilename(range: DateRange, now = new Date()): string {
  if (range.from || range.to) {
    return `snipsavor-report-${range.from ?? "start"}-to-${range.to ?? "today"}.csv`;
  }
  const dubai = new Date(now.getTime() + 4 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${dubai.getUTCFullYear()}-${pad(dubai.getUTCMonth() + 1)}-${pad(dubai.getUTCDate())}`;
  return `snipsavor-report-all-time-${stamp}.csv`;
}
