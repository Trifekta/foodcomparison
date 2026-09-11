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
];

export interface SchemaGap {
  file: string;
  breaks: string;
}

export async function findMissingMigrations(): Promise<SchemaGap[]> {
  const supabase = await createServerSupabaseClient();

  const results = await Promise.all(
    PROBES.map(async (probe) => {
      const { error } = await supabase.from("submissions").select(probe.column).limit(1);
      // Only a missing column counts. A permissions or network failure is a
      // different problem and must not be reported as a missing migration.
      const missing = error !== null && /column|does not exist|schema cache/i.test(error.message);
      return missing ? { file: probe.file, breaks: probe.breaks } : null;
    }),
  );

  return results.filter((gap): gap is SchemaGap => gap !== null);
}
