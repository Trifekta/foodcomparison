import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FUNNEL_STEPS, SIDE_EVENTS, isTrackedEvent } from "@/lib/analytics/funnel";

/**
 * The client and the database have to agree about what an event is called.
 *
 * They are two independent gates on the same list. isTrackedEvent() decides
 * what /api/events will forward; funnel_events_event_check decides what
 * Postgres will store. Nothing connects them but the intention that they match,
 * and when they stopped matching nobody found out for months.
 *
 * That is the failure this file exists for. app_opened and the five scroll
 * buckets were added to SIDE_EVENTS and never added to the constraint, so the
 * browser sent them, the route accepted them, and every insert was rejected -
 * silently, because /api/events swallows its errors by design so that counting
 * can never put an error in front of a customer. Both readings were empty from
 * the day they shipped, and the only symptom was a number that was always zero.
 *
 * Reading the migration rather than trusting a duplicated list here: a copy in
 * this file would drift exactly the same way the constraint did.
 */

const MIGRATIONS = path.join(process.cwd(), "supabase", "migrations");

/** The event names in the last migration that rewrites the check constraint. */
function allowedByDatabase(): string[] {
  const files = readdirSync(MIGRATIONS)
    .filter((name) => name.endsWith(".sql"))
    .sort();

  let latest: string | null = null;
  for (const name of files) {
    const sql = readFileSync(path.join(MIGRATIONS, name), "utf8");
    if (sql.includes("add constraint funnel_events_event_check")) latest = sql;
  }

  if (!latest) throw new Error("no migration defines funnel_events_event_check");

  // The `event in ( ... )` list of the constraint being added.
  const body = /add constraint funnel_events_event_check\s+check\s*\(\s*event in \(([\s\S]*?)\)/i.exec(
    latest,
  );
  if (!body) throw new Error("could not read the constraint's event list");

  return [...body[1].matchAll(/'([a-z0-9_]+)'/g)].map((match) => match[1]);
}

describe("funnel_events_event_check", () => {
  const allowed = allowedByDatabase();

  it("accepts every event the client is allowed to send", () => {
    const sent = [...FUNNEL_STEPS, ...SIDE_EVENTS].map((step) => step.event);
    const rejected = sent.filter((event) => !allowed.includes(event));

    expect(rejected).toEqual([]);
  });

  it("allows nothing the client would refuse to send", () => {
    const orphaned = allowed.filter((event) => !isTrackedEvent(event));

    expect(orphaned).toEqual([]);
  });

  it("names each event once", () => {
    expect(allowed).toEqual([...new Set(allowed)]);
  });
});
