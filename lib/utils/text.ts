/**
 * Text hygiene for anything a customer or admin types.
 *
 * Nothing here is rendered as HTML (React escapes by default) - this strips
 * control characters and caps length so stored values stay sane.
 */
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function sanitiseText(input: string | null | undefined, maxLength = 500): string | null {
  if (input === null || input === undefined) return null;
  const cleaned = input.replace(CONTROL_CHARS, "").replace(/\s+/g, " ").trim();
  if (cleaned === "") return null;
  return cleaned.slice(0, maxLength);
}

/** Same as sanitiseText but keeps newlines, for notes and generated messages. */
export function sanitiseMultiline(input: string | null | undefined, maxLength = 4000): string | null {
  if (input === null || input === undefined) return null;
  const cleaned = input
    .replace(CONTROL_CHARS, "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
  if (cleaned === "") return null;
  return cleaned.slice(0, maxLength);
}

export function formatDubaiTime(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dubai",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export function formatDubaiDateTime(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dubai",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

export function formatDubaiDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dubai",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

/**
 * "3 min ago", for a live view read at a glance rather than looked up.
 *
 * Computed once at render time, which is enough on a page that re-fetches on
 * its own interval (the admin's live view) - unlike a page left open for
 * hours, this one is never stale for longer than that interval.
 */
export function formatRelativeTime(value: string | Date, now: number = Date.now()): string {
  const then = typeof value === "string" ? Date.parse(value) : value.getTime();
  const seconds = Math.max(0, Math.round((now - then) / 1000));

  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

/**
 * The calendar date an instant falls on in Dubai, as YYYY-MM-DD.
 *
 * Every date filter in the dashboard is read as a Dubai day by the server
 * (see rangeToInstants), so anything that *produces* one of those dates has
 * to agree - including the "Today" buttons, which ran off the admin's own
 * device clock and so asked for a different day whenever that device was not
 * on Dubai time.
 */
export function dubaiIsoDate(value: string | number | Date = Date.now()): string {
  const date = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const part = (type: "year" | "month" | "day") =>
    parts.find((candidate) => candidate.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** The Dubai date some whole number of days before another one. Dubai has no
 * daylight saving, so the shift is plain arithmetic rather than a lookup. */
export function dubaiIsoDateDaysAgo(days: number, from: string | number | Date = Date.now()): string {
  const base = from instanceof Date ? from.getTime() : new Date(from).getTime();
  return dubaiIsoDate(base - days * 86_400_000);
}
