import type { Metadata } from "next";
import { Suspense } from "react";
import { Download } from "lucide-react";
import { AlertStatus } from "@/components/admin/AlertStatus";
import { SchemaWarning } from "@/components/admin/SchemaWarning";
import { SummaryCards } from "@/components/admin/SummaryCards";
import { SubmissionFilters } from "@/components/admin/SubmissionFilters";
import { SubmissionsTable } from "@/components/admin/SubmissionsTable";
import { ValidationStrip } from "@/components/admin/ValidationStrip";
import {
  getDashboardCounts,
  getSavingSummaryRows,
  listAreas,
  listSubmissions,
} from "@/lib/admin/queries";
import { filtersToQueryString, parseSubmissionFilters } from "@/lib/admin/filters";
import { computeSavingSummary } from "@/lib/calculations/analytics";
import { alertChannels } from "@/lib/notifications/admin-alert";
import { getWebPushPublicKey } from "@/lib/env";
import { findMissingMigrations } from "@/lib/admin/schema-check";
import { toPublicArea } from "@/lib/areas";

export const metadata: Metadata = {
  title: "Submissions",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;

  // The export route reads the URL through this same parser, so the file that
  // downloads holds exactly the rows the table is showing.
  const filters = parseSubmissionFilters(params);
  const exportQuery = filtersToQueryString(filters);

  // The summary is allowed to fail here. It names columns a database that is
  // behind may not have, so it throws - and if that took the whole dashboard
  // with it, the warning explaining why would never render.
  const [counts, rows, areas, summaryRows, gaps] = await Promise.all([
    getDashboardCounts(),
    listSubmissions(filters),
    listAreas(false),
    getSavingSummaryRows().catch(() => []),
    findMissingMigrations(),
  ]);

  const summary = computeSavingSummary(summaryRows);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-bold text-ink-900">Submissions</h1>
        <div className="flex items-baseline gap-4">
          <p className="text-sm text-ink-500">Newest first · {rows.length} shown</p>
          {/* A plain link, not a button: the response is a file, so the browser
              should do what it does with files and nothing should re-render. */}
          <a
            href={exportQuery ? `/admin/export?${exportQuery}` : "/admin/export"}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-ink-200 px-3 text-sm font-medium text-ink-700 hover:bg-ink-50"
          >
            <Download aria-hidden="true" className="h-3.5 w-3.5" />
            Export CSV
          </a>
        </div>
      </div>

      <SchemaWarning gaps={gaps} />
      <AlertStatus channels={alertChannels()} pushPublicKey={getWebPushPublicKey()} />
      <SummaryCards counts={counts} />
      <ValidationStrip summary={summary} />

      <Suspense fallback={<div className="h-20 rounded-2xl border border-ink-200 bg-white" />}>
        <SubmissionFilters areas={areas.map(toPublicArea)} />
      </Suspense>

      <SubmissionsTable rows={rows} />
    </div>
  );
}
