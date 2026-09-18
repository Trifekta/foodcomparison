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
