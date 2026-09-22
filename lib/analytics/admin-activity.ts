/**
 * The admin side's answer to funnel.ts.
 *
 * Same arrangement and for the same reason: the rule about what a section IS
 * lives in one place, imported by the thing that writes rows (lib/admin/
 * activity.ts) and by the dashboard that reads them. Split across the two, a
 * path normalised one way on write and labelled another way on read would drift
 * apart silently and nothing would fail.
 *
 * Nothing here touches a database or a clock it does not receive, so all of it
 * is testable directly - see tests/admin-activity.test.ts.
 */

/** Everything recorded lives under here. Anything else is not admin use. */
const ADMIN_ROOT = "/admin";

/**
 * A segment that is an id rather than a section.
 *
 * Collapsed to ":id" so that opening twelve orders is one row saying a section
 * was used twelve times, not twelve rows naming twelve customers. The log is
 * meant to say which parts of the dashboard somebody used; which individual
 * orders they read is submission_events' business, and putting it here would
 * quietly turn a section log into a browsing history over other people's data.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NUMERIC = /^\d+$/;
const LONG_HEX = /^[0-9a-f]{12,}$/i;

function isIdSegment(segment: string): boolean {
  return UUID.test(segment) || NUMERIC.test(segment) || LONG_HEX.test(segment);
}

/**
 * Requests a page makes on its own, which are not a person using anything.
 *
 * The new-visit chime polls this every few seconds from whichever admin page
 * happens to be open, so a tab left open overnight would otherwise write an
 * unbroken record of "still using the dashboard" for somebody who went home.
 * Kept out entirely, which is the same call funnel_events makes about
 * heartbeats: the pulse is real and it is not a step.
 *
 * Deliberately not "every route handler". An export route is a person pressing
 * a button and belongs in the log; this one is a timer.
 */
const BACKGROUND_PATHS = new Set([`${ADMIN_ROOT}/new-visits`]);

/** Long enough for any real section, short enough that a junk URL cannot bloat a row. */
const MAX_PATH_LENGTH = 120;

/**
 * A URL or pathname, reduced to the section it belongs to - or null if this
 * request is not a person using the dashboard.
 *
 * Null rather than a fallback value on purpose: a request that is not admin use
 * should leave no row at all, and a catch-all bucket would be indistinguishable
 * from a real section nobody bothered to label.
 */
export function normaliseAdminPath(value: string | null | undefined): string | null {
  if (!value) return null;

  // Query strings and fragments are arguments to a section, not sections. The
  // submissions list is one section whether or not it is filtered by status,
  // and keeping the search string would put a customer's phone number in here.
  const pathname = value.split("?")[0].split("#")[0].trim();
  if (!pathname.startsWith(ADMIN_ROOT)) return null;

  // "/administrators" starts with "/admin" and is not it.
  if (pathname !== ADMIN_ROOT && !pathname.startsWith(`${ADMIN_ROOT}/`)) return null;

  const segments = pathname
    .split("/")
    .filter(Boolean)
    .map((segment) => (isIdSegment(segment) ? ":id" : segment));

  const normalised = `/${segments.join("/")}`;
  if (BACKGROUND_PATHS.has(normalised)) return null;

  return normalised.slice(0, MAX_PATH_LENGTH);
}

/**
 * What each section is called in the log.
 *
 * The names match the nav where a nav entry exists, so a row reads the way the
 * person remembers using it rather than as a URL. Sections with no entry here
 * fall back to their path, which is how a new page shows up in the log the day
 * it ships instead of the day somebody remembers to add it.
 */
const SECTION_LABELS: Record<string, string> = {
  [`${ADMIN_ROOT}/login`]: "Signed in",
  [ADMIN_ROOT]: "Submissions",
  [`${ADMIN_ROOT}/submissions/:id`]: "Opened an order",
  [`${ADMIN_ROOT}/live`]: "Live",
  [`${ADMIN_ROOT}/live/visits`]: "Visit history",
  [`${ADMIN_ROOT}/analytics`]: "Validation",
  [`${ADMIN_ROOT}/attribution`]: "Attribution",
  [`${ADMIN_ROOT}/areas`]: "Areas",
  [`${ADMIN_ROOT}/activity`]: "Team activity",
  [`${ADMIN_ROOT}/diagnostics`]: "Diagnostics",
  [`${ADMIN_ROOT}/report`]: "Downloaded the report",
  [`${ADMIN_ROOT}/export`]: "Downloaded submissions",
  [`${ADMIN_ROOT}/visits-export`]: "Downloaded visits",
  [`${ADMIN_ROOT}/api/validation-export`]: "Downloaded the validation export",
};

export function adminSectionLabel(path: string): string {
  return SECTION_LABELS[path] ?? path;
}

/**
 * The path recorded when somebody signs in.
 *
 * Sign-in is a section like any other rather than a column of its own, which
 * keeps the table one shape. Only a SUCCESSFUL sign-in by somebody who turns
 * out to hold an admin profile can be recorded - a failed attempt has no admin
 * id to record it against - so this row's hits are that day's sign-ins exactly,
 * and its first_seen_at is when the day started.
 */
export const SIGN_IN_PATH = `${ADMIN_ROOT}/login`;

export interface AdminActivityRow {
  admin_id: string;
  day: string;
  path: string;
  first_seen_at: string;
  last_seen_at: string;
  hits: number;
  admin_profiles: { display_name: string | null } | null;
}

export interface AdminSectionUse {
  path: string;
  label: string;
  hits: number;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface AdminDayActivity {
  adminId: string;
  /** The profile's display name, or the admin id when it has none. */
  name: string;
  day: string;
  /** When this admin's day on the dashboard started and when it last moved. */
  firstSeenAt: string;
  lastSeenAt: string;
  /** Sections this admin used that day, in the order they first opened them. */
  sections: AdminSectionUse[];
  /** Server requests across every section - see the column comment. */
  totalHits: number;
  /** Whether a sign-in was recorded that day, rather than an existing session. */
  signedIn: boolean;
}

/**
 * Rows collapsed into one entry per admin per day.
 *
 * The table already stores one row per SECTION per admin per day, which is the
 * right grain to write and the wrong one to read: a day on the dashboard is one
 * thing a person did, and listing its eight sections as eight top-level rows
 * buries that. Grouped here instead, so the view can show "Tuesday, 09:02 to
 * 18:41, these sections" and expand.
 *
 * Sorted newest day first, and within a day by who started earliest - a stable
 * order that does not move as hits accumulate.
 */
/**
 * Timestamps compared as instants, never as strings.
 *
 * Postgres hands these back with whatever fractional-second precision the value
 * happened to have, so two readings of the same moment can differ in length.
 * Comparing the text would order those by digit count.
 */
function earlier(a: string, b: string): boolean {
  return Date.parse(a) < Date.parse(b);
}

export function summariseAdminActivity(rows: AdminActivityRow[]): AdminDayActivity[] {
  const byAdminDay = new Map<string, AdminDayActivity>();

  for (const row of rows) {
    const key = `${row.day}\u0000${row.admin_id}`;
    const existing = byAdminDay.get(key);

    const section: AdminSectionUse = {
      path: row.path,
      label: adminSectionLabel(row.path),
      hits: row.hits,
      firstSeenAt: row.first_seen_at,
      lastSeenAt: row.last_seen_at,
    };

    if (!existing) {
      byAdminDay.set(key, {
        adminId: row.admin_id,
        name: row.admin_profiles?.display_name?.trim() || row.admin_id,
        day: row.day,
        firstSeenAt: row.first_seen_at,
        lastSeenAt: row.last_seen_at,
        sections: [section],
        totalHits: row.hits,
        signedIn: row.path === SIGN_IN_PATH,
      });
      continue;
    }

    existing.sections.push(section);
    existing.totalHits += row.hits;
    existing.signedIn = existing.signedIn || row.path === SIGN_IN_PATH;
    if (earlier(row.first_seen_at, existing.firstSeenAt)) existing.firstSeenAt = row.first_seen_at;
    if (earlier(existing.lastSeenAt, row.last_seen_at)) existing.lastSeenAt = row.last_seen_at;
  }

  const days = [...byAdminDay.values()];
  for (const entry of days) {
    entry.sections.sort(
      (a, b) =>
        Date.parse(a.firstSeenAt) - Date.parse(b.firstSeenAt) || a.label.localeCompare(b.label),
    );
  }

  return days.sort(
    (a, b) =>
      b.day.localeCompare(a.day) ||
      Date.parse(a.firstSeenAt) - Date.parse(b.firstSeenAt) ||
      a.name.localeCompare(b.name),
  );
}
