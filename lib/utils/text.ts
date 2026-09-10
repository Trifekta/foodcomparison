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
