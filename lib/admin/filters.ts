import { STATUS_ORDER } from "@/lib/utils/status";
import type { SubmissionStatus } from "@/types/database";
import type { SubmissionFilters } from "./queries";

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
