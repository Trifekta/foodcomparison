import { STATUS_ORDER } from "@/lib/utils/status";
import type { SubmissionStatus } from "@/types/database";
import type { DateRange, SubmissionFilters } from "./queries";

/**
 * One reading of the dashboard's query string.
 *
 * The list and the export have to agree about what the filters mean, or the
 * downloaded file quietly holds different rows from the table it was downloaded
 * from - which is the kind of wrong nobody notices until a decision has been
 * made on it. So both read the URL through here.
 */

export type RawSearchParams = Record<string, string | string[] | undefined>;

/** First value, trimmed, or undefined for an empty one. */
export function single(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && raw.trim() !== "" ? raw.trim() : undefined;
}

const ARCHIVE_VIEWS = ["active", "archived", "all"] as const;
type ArchiveView = (typeof ARCHIVE_VIEWS)[number];

export function parseSubmissionFilters(params: RawSearchParams): SubmissionFilters {
  const statusParam = single(params.status);
  const archivedParam = single(params.archived);

  return {
    status: STATUS_ORDER.includes(statusParam as SubmissionStatus)
      ? (statusParam as SubmissionStatus)
      : "all",
    // Anything unrecognised falls back to the working list rather than showing
    // everything: a typo in the URL should not quietly widen what is on screen.
    archived: ARCHIVE_VIEWS.includes(archivedParam as ArchiveView)
      ? (archivedParam as ArchiveView)
      : "active",
    areaId: single(params.area),
    sourceApp: single(params.app),
    from: single(params.from),
    to: single(params.to),
    search: single(params.search),
  };
}

/** The same filters as a query string, for the export link under the table. */
export function filtersToQueryString(filters: SubmissionFilters): string {
  const query = new URLSearchParams();
  if (filters.status && filters.status !== "all") query.set("status", filters.status);
  if (filters.archived && filters.archived !== "active") query.set("archived", filters.archived);
  if (filters.areaId) query.set("area", filters.areaId);
  if (filters.sourceApp) query.set("app", filters.sourceApp);
  if (filters.from) query.set("from", filters.from);
  if (filters.to) query.set("to", filters.to);
  if (filters.search) query.set("search", filters.search);
  return query.toString();
}


/** Matches an ISO calendar date, which is what a date input produces. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The report's date range, read from the same `from` and `to` the dashboard
 * already uses — so a range typed on one screen means the same thing on the
 * other, and the downloaded file matches the page it came from.
 *
 * Anything that is not a plain calendar date is dropped rather than passed
 * through: an unparseable bound would otherwise reach Postgres and take the
 * whole report down over a typo.
 */
export function parseDateRange(params: RawSearchParams): DateRange {
  const from = single(params.from);
  const to = single(params.to);
  const range: DateRange = {};
  if (from && ISO_DATE.test(from)) range.from = from;
  if (to && ISO_DATE.test(to)) range.to = to;

  // Backwards is almost always a slip, and an empty report is a confusing way
  // to be told about it. Swapping gives the range they plainly meant.
  if (range.from && range.to && range.from > range.to) {
    return { from: range.to, to: range.from };
  }
  return range;
}

/** The range as a query string, for the report link. */
export function rangeToQueryString(range: DateRange): string {
  const query = new URLSearchParams();
  if (range.from) query.set("from", range.from);
  if (range.to) query.set("to", range.to);
  return query.toString();
}
