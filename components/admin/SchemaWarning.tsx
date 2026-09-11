import { AlertTriangle } from "lucide-react";
import type { SchemaGap } from "@/lib/admin/schema-check";

/**
 * The database is behind the code, and here is the file that fixes it.
 *
 * Loud on purpose: until it is run, the admin's own buttons throw, and the only
 * other clue is an error page that says nothing.
 */
export function SchemaWarning({ gaps }: { gaps: SchemaGap[] }) {
  if (gaps.length === 0) return null;

  return (
    <section
      role="alert"
      className="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-rose-900"
    >
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <AlertTriangle aria-hidden="true" className="h-4 w-4" />
        {gaps.length === 1 ? "A migration has not been run" : "Migrations have not been run"}
      </h2>
      <p className="mt-1.5 text-sm">
        Run {gaps.length === 1 ? "this file" : "these files"} against the database in the Supabase
        SQL editor. Until then the buttons below fail with &ldquo;Something went wrong&rdquo;.
      </p>
      <ul className="mt-3 space-y-2">
        {gaps.map((gap) => (
          <li key={gap.file} className="rounded-xl bg-white/70 p-3">
            <code className="text-sm font-semibold">supabase/migrations/{gap.file}</code>
            <p className="mt-1 text-sm text-rose-800">Without it: {gap.breaks}.</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
