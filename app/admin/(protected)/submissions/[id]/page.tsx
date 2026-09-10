import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MapPin } from "lucide-react";
import {
  getSignedImageUrl,
  getSubmission,
  getSubmissionEvents,
  getSubmissionItems,
} from "@/lib/admin/queries";
import { isEmailConfigured } from "@/lib/notifications/resend";
import { ScreenshotViewer } from "@/components/admin/ScreenshotViewer";
import { ComparisonPanel } from "@/components/admin/ComparisonPanel";
import { ResultPanel } from "@/components/admin/ResultPanel";
import { StartReviewButton } from "@/components/admin/StartReviewButton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDecimalStringAsCurrency } from "@/lib/calculations/money";
import { formatDubaiDateTime } from "@/lib/utils/text";
import { maskEmail } from "@/lib/utils/phone";
import { statusLabel } from "@/lib/utils/status";

export const metadata: Metadata = {
  title: "Submission",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="text-sm text-ink-500">{label}</dt>
      <dd className="text-right text-sm font-semibold text-ink-900">{value}</dd>
    </div>
  );
}

export default async function SubmissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const submission = await getSubmission(id);
  if (!submission) notFound();

  const [cartUrl, checkoutUrl, events, items] = await Promise.all([
    getSignedImageUrl(submission.cart_image_path),
    getSignedImageUrl(submission.checkout_image_path),
    getSubmissionEvents(submission.id),
    getSubmissionItems(submission.id),
  ]);

  const appLabel =
    submission.source_app === "Other" && submission.source_app_other
      ? submission.source_app_other
      : submission.source_app;

  const hasSaving = Number(submission.saving_amount ?? 0) > 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/admin"
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 text-sm font-medium text-ink-700 hover:bg-ink-50"
        >
          <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
          All submissions
        </Link>
        <h1 className="text-xl font-bold tabular-nums text-ink-900">
          {submission.reference_number}
        </h1>
        <StatusBadge status={submission.status} />

        {submission.status === "new" ? (
          <div className="ml-auto w-full sm:w-auto">
            <StartReviewButton submissionId={submission.id} />
          </div>
        ) : null}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* ---------------- Left: what the customer sent ---------------- */}
        <div className="space-y-5">
          <section className="rounded-2xl border border-ink-200 bg-white p-5">
            <h2 className="text-base font-semibold text-ink-900">Order</h2>
            <dl className="mt-3 divide-y divide-ink-100">
              <Row label="Submitted" value={formatDubaiDateTime(submission.created_at)} />
              <Row label="Restaurant" value={submission.restaurant_name ?? "—"} />
              <Row label="Area" value={submission.areas?.name ?? "—"} />
              <Row label="Ordering from" value={appLabel} />
              <Row
                label="Current total"
                value={
                  <span className="text-base">
                    {formatDecimalStringAsCurrency(submission.current_total)}
                  </span>
                }
              />
              <Row
                label="Contact"
                value={
                  submission.contact_type === "whatsapp"
                    ? `WhatsApp ${submission.whatsapp_number ?? ""}`
                    : `Email ${submission.email ? maskEmail(submission.email) : ""}`
                }
              />
            </dl>

            {submission.areas?.test_location_label || submission.areas?.admin_location_notes ? (
              <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50 p-3.5">
                <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-brand-800">
                  <MapPin aria-hidden="true" className="h-3.5 w-3.5" />
                  Internal test location
                </p>
                {submission.areas.test_location_label ? (
                  <p className="mt-1 text-sm font-semibold text-ink-900">
                    {submission.areas.test_location_label}
                  </p>
                ) : null}
                {submission.areas.admin_location_notes ? (
                  <p className="mt-0.5 text-sm text-ink-600">
                    {submission.areas.admin_location_notes}
                  </p>
                ) : null}
              </div>
            ) : null}
          </section>

          {/* What the customer typed in. The screenshot below is still the
              source of truth - this list is optional and may be incomplete. */}
          <section className="rounded-2xl border border-ink-200 bg-white p-5">
            <h2 className="text-base font-semibold text-ink-900">
              Items the customer listed
            </h2>
            {items.length > 0 ? (
              <>
                <ul className="mt-3 divide-y divide-ink-100">
                  {items.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-start justify-between gap-4 py-2.5 text-sm"
                    >
                      <span className="min-w-0 break-words font-semibold text-ink-900">
                        {item.name}
                      </span>
                      <span className="shrink-0 tabular-nums text-ink-500">
                        &times;{item.quantity}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-ink-500">
                  Typed by the customer, not read from the screenshot. Check it against the cart
                  below.
                </p>
              </>
            ) : (
              <p className="mt-1.5 text-sm text-ink-500">
                Customer did not list items. Rebuild the basket from the cart screenshot.
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-ink-200 bg-white p-5">
            <h2 className="text-base font-semibold text-ink-900">Cart screenshot</h2>
            <div className="mt-3">
              <ScreenshotViewer
                url={cartUrl}
                label={`Cart screenshot for ${submission.reference_number}`}
                emptyMessage="This screenshot is no longer available."
              />
            </div>
          </section>

          <section className="rounded-2xl border border-ink-200 bg-white p-5">
            <h2 className="text-base font-semibold text-ink-900">Checkout screenshot</h2>
            <div className="mt-3">
              <ScreenshotViewer
                url={checkoutUrl}
                label={`Checkout screenshot for ${submission.reference_number}`}
                emptyMessage={
                  submission.checkout_image_path
                    ? "This screenshot is no longer available."
                    : "Customer did not provide checkout screenshot."
                }
              />
            </div>
          </section>
        </div>

        {/* ---------------- Right: the comparison workflow ---------------- */}
        <div className="space-y-5">
          <ComparisonPanel
            submissionId={submission.id}
            comparisonApp={submission.comparison_app}
            sourceAppLabel={appLabel}
            currentTotal={submission.current_total}
            areaName={submission.areas?.name ?? "Dubai"}
            initial={{
              comparisonTotal: submission.comparison_total ?? "",
              restaurantFound: submission.restaurant_found ?? "",
              comparisonLocationNote: submission.comparison_location_note ?? "",
              adminNotes: submission.admin_notes ?? "",
            }}
          />

          {submission.result_message ? (
            <ResultPanel
              submissionId={submission.id}
              reference={submission.reference_number}
              message={submission.result_message}
              hasSaving={hasSaving}
              contactType={submission.contact_type}
              whatsappNumber={submission.whatsapp_number}
              email={submission.email}
              alreadySent={submission.status === "result_sent"}
              emailConfigured={isEmailConfigured()}
            />
          ) : (
            <section className="rounded-2xl border border-dashed border-ink-300 bg-white p-5">
              <h2 className="text-base font-semibold text-ink-900">Customer result</h2>
              <p className="mt-1.5 text-sm text-ink-500">
                Save a comparison above and the customer message appears here, ready to send.
              </p>
            </section>
          )}

          <section className="rounded-2xl border border-ink-200 bg-white p-5">
            <h2 className="text-base font-semibold text-ink-900">History</h2>
            <ol className="mt-3 space-y-2.5">
              {events.map((event) => (
                <li key={event.id} className="flex items-baseline justify-between gap-4 text-sm">
                  <span className="text-ink-700">
                    {event.event_type.replace(/_/g, " ")}
                    {event.new_status ? (
                      <span className="text-ink-400"> → {statusLabel(event.new_status)}</span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-xs text-ink-400">
                    {formatDubaiDateTime(event.created_at)}
                  </span>
                </li>
              ))}
              {events.length === 0 ? (
                <li className="text-sm text-ink-500">Nothing recorded yet.</li>
              ) : null}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
