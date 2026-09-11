import type { Metadata } from "next";
import { Suspense } from "react";
import { AlertStatus } from "@/components/admin/AlertStatus";
import { SchemaWarning } from "@/components/admin/SchemaWarning";
import { SummaryCards } from "@/components/admin/SummaryCards";
import { SubmissionFilters } from "@/components/admin/SubmissionFilters";
import { SubmissionsTable } from "@/components/admin/SubmissionsTable";
import { ValidationStrip } from "@/components/admin/ValidationStrip";
import {
  getAnalyticsRows,
  getDashboardCounts,
  listAreas,
  listSubmissions,
  type SubmissionFilters as Filters,
} from "@/lib/admin/queries";
import { computeValidationMetrics } from "@/lib/calculations/analytics";
import { alertChannels } from "@/lib/notifications/admin-alert";
import { findMissingMigrations } from "@/lib/admin/schema-check";
import { STATUS_ORDER } from "@/lib/utils/status";
import type { SubmissionStatus } from "@/types/database";

export const metadata: Metadata = {
  title: "Submissions",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function single(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && raw.trim() !== "" ? raw.trim() : undefined;
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;

  const statusParam = single(params.status);
  const filters: Filters = {
    status: STATUS_ORDER.includes(statusParam as SubmissionStatus)
      ? (statusParam as SubmissionStatus)
      : "all",
    areaId: single(params.area),
    sourceApp: single(params.app),
    from: single(params.from),
    to: single(params.to),
    search: single(params.search),
  };

  // Analytics is allowed to fail here. It is the query that names the newest
  // columns, so on a database that is behind it throws - and if that took the
  // whole dashboard with it, the warning explaining why would never render.
  const [counts, rows, areas, analyticsRows, gaps] = await Promise.all([
    getDashboardCounts(),
    listSubmissions(filters),
    listAreas(false),
    getAnalyticsRows().catch(() => []),
    findMissingMigrations(),
  ]);

  const metrics = computeValidationMetrics(analyticsRows);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-bold text-ink-900">Submissions</h1>
        <p className="text-sm text-ink-500">Newest first · {rows.length} shown</p>
      </div>

      <SchemaWarning gaps={gaps} />
      <AlertStatus channels={alertChannels()} />
      <SummaryCards counts={counts} />
      <ValidationStrip metrics={metrics} />

      <Suspense fallback={<div className="h-20 rounded-2xl border border-ink-200 bg-white" />}>
        <SubmissionFilters areas={areas.map((area) => ({ id: area.id, name: area.name }))} />
      </Suspense>

      <SubmissionsTable rows={rows} />
    </div>
  );
}
