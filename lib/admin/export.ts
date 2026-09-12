import type { SubmissionListRow } from "./queries";
import { formatDecimalStringAsCurrency } from "@/lib/calculations/money";
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
