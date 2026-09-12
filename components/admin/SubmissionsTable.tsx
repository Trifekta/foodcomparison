import Link from "next/link";
import { Mail, MessageCircle } from "lucide-react";
import type { SubmissionListRow } from "@/lib/admin/queries";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDecimalStringAsCurrency, formatPercentage } from "@/lib/calculations/money";
import { formatDubaiTime } from "@/lib/utils/text";
import { SubmissionRowActions } from "@/components/admin/SubmissionRowActions";

function appLabel(row: SubmissionListRow): string {
  return row.source_app === "Other" && row.source_app_other
    ? row.source_app_other
    : row.source_app;
}

function savingCell(row: SubmissionListRow) {
  if (row.comparison_total === null) return <span className="text-ink-400">—</span>;

  const amount = formatDecimalStringAsCurrency(row.saving_amount);
  const hasSaving = Number(row.saving_amount ?? 0) > 0;

  if (!hasSaving) return <span className="text-ink-500">No saving</span>;

  return (
    <span className="font-semibold text-emerald-700">
      {amount}
      <span className="ml-1 font-normal text-ink-500">
        {formatPercentage(row.saving_percentage)}
      </span>
    </span>
  );
}

/**
 * Submissions list.
 *
 * The dashboard is built for a desktop, but an admin checking their phone still
 * needs it. Below `md` the same rows render as cards, so the page never scrolls
 * sideways; from `md` up it is the full table.
 */
export function SubmissionsTable({ rows }: { rows: SubmissionListRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-ink-300 bg-white p-10 text-center">
        <p className="text-sm font-semibold text-ink-800">No submissions here yet</p>
        <p className="mt-1 text-sm text-ink-500">
          New customer submissions appear at the top of this list.
        </p>
      </div>
    );
  }

  return (
    <>
      <ul className="space-y-3 md:hidden">
        {rows.map((row) => (
          <li key={row.id} className="rounded-2xl border border-ink-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold tabular-nums text-ink-900">{row.reference_number}</p>
                <p className="mt-0.5 text-xs text-ink-500">
                  {formatDubaiTime(row.created_at)} · {row.areas?.name ?? "—"}
                </p>
              </div>
              <StatusBadge status={row.status} />
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-ink-500">App</dt>
                <dd className="text-ink-800">{appLabel(row)}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-500">Current total</dt>
                <dd className="tabular-nums text-ink-900">
                  {formatDecimalStringAsCurrency(row.current_total)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-500">Saving</dt>
                <dd className="tabular-nums">{savingCell(row)}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-500">Contact</dt>
                <dd className="text-ink-800">
                  {row.contact_type === "whatsapp" ? "WhatsApp" : "Email"}
                </dd>
              </div>
            </dl>

            <Link
              href={`/admin/submissions/${row.id}`}
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-ink-200 text-sm font-semibold text-ink-800 hover:bg-ink-50"
            >
              {row.status === "new" ? "Review" : "Open"}
              <span className="sr-only"> submission {row.reference_number}</span>
            </Link>

            <SubmissionRowActions
              className="mt-2 flex-wrap"
              submissionId={row.id}
              reference={row.reference_number}
              archivedAt={row.archived_at}
            />
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto rounded-2xl border border-ink-200 bg-white md:block">
      <table className="w-full min-w-[52rem] border-collapse text-sm">
        <caption className="sr-only">Customer submissions, newest first</caption>
        <thead>
          <tr className="border-b border-ink-200 text-left text-xs uppercase tracking-wide text-ink-500">
            <th scope="col" className="px-4 py-3 font-semibold">Reference</th>
            <th scope="col" className="px-4 py-3 font-semibold">Time</th>
            <th scope="col" className="px-4 py-3 font-semibold">Area</th>
            <th scope="col" className="px-4 py-3 font-semibold">App</th>
            <th scope="col" className="px-4 py-3 font-semibold">Current total</th>
            <th scope="col" className="px-4 py-3 font-semibold">Saving</th>
            <th scope="col" className="px-4 py-3 font-semibold">Status</th>
            <th scope="col" className="px-4 py-3 font-semibold">Contact</th>
            <th scope="col" className="px-4 py-3 font-semibold">
              <span className="sr-only">Action</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-brand-50/40">
              <td className="px-4 py-3 font-semibold tabular-nums text-ink-900">
                {row.reference_number}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-ink-600">
                {formatDubaiTime(row.created_at)}
              </td>
              <td className="px-4 py-3 text-ink-700">{row.areas?.name ?? "—"}</td>
              <td className="px-4 py-3 text-ink-700">{appLabel(row)}</td>
              <td className="px-4 py-3 whitespace-nowrap tabular-nums text-ink-900">
                {formatDecimalStringAsCurrency(row.current_total)}
              </td>
              <td className="px-4 py-3 whitespace-nowrap tabular-nums">{savingCell(row)}</td>
              <td className="px-4 py-3">
                <StatusBadge status={row.status} />
              </td>
              <td className="px-4 py-3">
                <span className="inline-flex items-center gap-1.5 text-ink-600">
                  {row.contact_type === "whatsapp" ? (
                    <MessageCircle aria-hidden="true" className="h-3.5 w-3.5" />
                  ) : (
                    <Mail aria-hidden="true" className="h-3.5 w-3.5" />
                  )}
                  {row.contact_type === "whatsapp" ? "WhatsApp" : "Email"}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-1">
                  <Link
                    href={`/admin/submissions/${row.id}`}
                    className="inline-flex min-h-9 items-center rounded-lg border border-ink-200 px-3 font-semibold text-ink-800 hover:bg-ink-50"
                  >
                    {row.status === "new" ? "Review" : "Open"}
                    <span className="sr-only"> submission {row.reference_number}</span>
                  </Link>
                  <SubmissionRowActions
                    submissionId={row.id}
                    reference={row.reference_number}
                    archivedAt={row.archived_at}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </>
  );
}
