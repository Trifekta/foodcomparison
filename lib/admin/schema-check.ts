import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Whether the database has caught up with the code.
 *
 * Migrations here are applied by hand, so the two can drift - and when they do
 * the symptom is brutal: a query naming a column that does not exist fails, the
 * page throws, and the admin sees "Something went wrong" with nothing to act
 * on. Every button on the submission page goes through one such query, so a
 * missing migration looks exactly like the app being broken.
 *
 * This turns that into a sentence naming the file to run. It costs one small
 * query per migration and only runs on the dashboard.
 */

interface MigrationProbe {
  /** The file to run, as it is named on disk. */
  file: string;
  /** A column it adds. Selecting it is the cheapest possible existence check. */
  column: string;
  /** What stops working without it, in the admin's terms. */
  breaks: string;
}

const PROBES: MigrationProbe[] = [
  {
    file: "0007_result_link.sql",
    column: "result_token",
    breaks: "saving a comparison, starting a review, and the customer's result page",
  },
  {
    file: "0008_unavailable_outcome.sql",
    column: "unavailable_reason",
    breaks: "recording that a basket could not be compared, and the analytics page",
  },
  {
    file: "0010_admin_submission_management.sql",
    column: "archived_at",
    breaks: "archiving and deleting a submission, the submissions list, and the export",
  },
];

/**
 * Probes against other tables, which cannot use the submissions query above.
 */
const OTHER_PROBES: { file: string; table: string; column: string; breaks: string }[] = [
  {
    file: "0011_funnel_area.sql",
    table: "funnel_events",
    column: "area_id",
    breaks: "the per-area funnel on the Validation page and in the report",
  },
];

export interface SchemaGap {
  file: string;
  breaks: string;
  /** The database's own words, for the diagnostics page. */
  detail: string;
}

export async function findMissingMigrations(): Promise<SchemaGap[]> {
  const supabase = await createServerSupabaseClient();

  const results = await Promise.all(
    PROBES.map(async (probe) => {
      const { error } = await supabase.from("submissions").select(probe.column).limit(1);
      // Only a missing column counts. A permissions or network failure is a
      // different problem and must not be reported as a missing migration.
      const missing = error !== null && /column|does not exist|schema cache/i.test(error.message);
      return missing ? { file: probe.file, breaks: probe.breaks, detail: error.message } : null;
    }),
  );

  const others = await Promise.all(
    OTHER_PROBES.map(async (probe) => {
      const { error } = await supabase.from(probe.table).select(probe.column).limit(1);
      // A missing TABLE is a different migration's problem - 0009 creates
      // funnel_events - so only a missing column is reported here, or a
      // database without the funnel at all would be told to run the wrong file.
      const missingColumn =
        error !== null &&
        /column|schema cache/i.test(error.message) &&
        !/relation .* does not exist/i.test(error.message);
      return missingColumn
        ? { file: probe.file, breaks: probe.breaks, detail: error.message }
        : null;
    }),
  );

  return [...results, ...others].filter((gap): gap is SchemaGap => gap !== null);
}

export interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

/**
 * Runs the queries the admin's own buttons run, and reports what came back.
 *
 * The point is the raw message. Next redacts a server error in production, so
 * a failing action shows "Something went wrong" and nothing else - while the
 * database has almost certainly said precisely what is wrong. This asks it the
 * same questions and prints the answers.
 */
export async function runDiagnostics(): Promise<Check[]> {
  const supabase = await createServerSupabaseClient();
  const checks: Check[] = [];

  // A thenable rather than a Promise: a PostgREST builder only becomes one when
  // awaited, which is exactly what happens on the next line.
  const record = async (
    name: string,
    run: () => PromiseLike<{ error: { message: string } | null }>,
  ) => {
    try {
      const { error } = await run();
      checks.push({ name, ok: error === null, detail: error?.message ?? "OK" });
    } catch (error) {
      checks.push({
        name,
        ok: false,
        detail: error instanceof Error ? error.message : "Threw a non-Error",
      });
    }
  };

  // Exactly the projection every button on the submission page loads through.
  await record("Load a submission (every admin button)", () =>
    supabase
      .from("submissions")
      .select(
        "id, status, source_app, source_app_other, current_total, comparison_total, comparison_app, contact_type, whatsapp_number, email, reference_number, restaurant_name, result_message, result_token",
      )
      .limit(1),
  );

  await record("Save a comparison (writes comparison_url)", () =>
    supabase.from("submissions").select("comparison_url").limit(1),
  );

  await record("Record couldn't compare (writes unavailable_reason)", () =>
    supabase.from("submissions").select("unavailable_reason").limit(1),
  );

  await record("Analytics page", () =>
    supabase
      .from("submissions")
      .select("status, source_app, current_total, restaurant_name, unavailable_reason")
      .limit(1),
  );

  await record("Archive a submission (writes archived_at)", () =>
    supabase.from("submissions").select("archived_at").limit(1),
  );

  await record("Write an event row", () =>
    supabase.from("submission_events").select("event_type").limit(1),
  );

  await record("Read the item list", () =>
    supabase.from("submission_items").select("id").limit(1),
  );

  await record("Read extractions", () =>
    supabase.from("submission_extractions").select("id").limit(1),
  );

  return checks;
}
