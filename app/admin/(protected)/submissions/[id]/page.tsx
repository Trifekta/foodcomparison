import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, MapPin } from "lucide-react";
import {
  getLatestExtraction,
  getSignedImageUrl,
  getSubmission,
  getSubmissionEvents,
  getSubmissionItems,
  listAreas,
} from "@/lib/admin/queries";
import { isEmailConfigured } from "@/lib/notifications/resend";
import { isExtractionConfigured } from "@/lib/env";
import { ExtractionPanel } from "@/components/admin/ExtractionPanel";
import type { StructuredBasket } from "@/lib/extraction/schema";
import { ScreenshotViewer } from "@/components/admin/ScreenshotViewer";
import { ComparisonPanel } from "@/components/admin/ComparisonPanel";
import { ResultPanel } from "@/components/admin/ResultPanel";
import { StartReviewButton } from "@/components/admin/StartReviewButton";
import { EditSubmissionPanel } from "@/components/admin/EditSubmissionPanel";
import { SubmissionRowActions } from "@/components/admin/SubmissionRowActions";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDecimalStringAsCurrency, formatMinorAsCurrency } from "@/lib/calculations/money";
import { formatDubaiDateTime } from "@/lib/utils/text";
import { LEGACY_OTHER_APP } from "@/lib/constants";
import { resultPath } from "@/lib/utils/reference";
import { maskEmail } from "@/lib/utils/phone";
import { statusLabel } from "@/lib/utils/status";
import type { SubmissionItemSource } from "@/types/database";

export const metadata: Metadata = {
  title: "Submission",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** Says whether a row was typed, read from the screenshot, or read then fixed. */
function SourceBadge({ source }: { source: SubmissionItemSource }) {
  if (source === "customer") return null;

  const corrected = source === "edited";
  return (
    <span
      className={`ml-2 inline-block rounded px-1.5 py-0.5 align-middle text-[0.65rem] font-bold uppercase tracking-wide ${
        corrected ? "bg-amber-100 text-amber-800" : "bg-ink-100 text-ink-600"
      }`}
      title={
        corrected
          ? "Read from the screenshot, then corrected by the customer"
          : "Read from the screenshot and confirmed unchanged"
      }
    >
      {corrected ? "read · fixed" : "read"}
    </span>
  );
}

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

  const [cartUrl, checkoutUrl, events, items, extraction, areas] = await Promise.all([
    getSignedImageUrl(submission.cart_image_path),
    getSignedImageUrl(submission.checkout_image_path),
    getSubmissionEvents(submission.id),
    getSubmissionItems(submission.id),
    getLatestExtraction(submission.id),
    listAreas(false),
  ]);

  const appLabel =
    submission.source_app === LEGACY_OTHER_APP && submission.source_app_other
      ? submission.source_app_other
      : submission.source_app;

  const hasSaving = Number(submission.saving_amount ?? 0) > 0;

  const pricedItems = items.filter((item) => item.line_price_minor !== null);
  const pricedCount = pricedItems.length;
  const itemsSubtotal =
    pricedCount > 0
      ? pricedItems.reduce((sum, item) => sum + (item.line_price_minor ?? 0), 0)
      : null;

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

        {submission.archived_at ? (
          <span className="rounded-full bg-ink-100 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-ink-600">
            Archived
          </span>
        ) : null}

        {submission.status === "new" ? (
          <div className="ml-auto w-full sm:w-auto">
            <StartReviewButton submissionId={submission.id} />
          </div>
        ) : null}
      </div>

      {/* Editing and removing sit together, above the record rather than inside
          it: they act on the submission as a whole, not on any one panel. */}
      <div className="flex flex-wrap items-center gap-2">
        <EditSubmissionPanel
          submission={submission}
          areas={areas.map((area) => ({ id: area.id, name: area.name }))}
        />
        <SubmissionRowActions
          submissionId={submission.id}
          reference={submission.reference_number}
          archivedAt={submission.archived_at}
          redirectAfterDelete
        />
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
              {/* The customer's own page, so an admin can see exactly what they
                  are looking at right now. */}
              <Row
                label="Customer result page"
                value={
                  <a
                    href={resultPath(submission.result_token)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 font-medium text-ink-900 underline underline-offset-2"
                  >
                    Open
                    <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                  </a>
                }
              />
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

          {/* The basket as the customer confirmed it. Some rows may have been
              proposed by a screenshot read; the badge says which, and the
              screenshot below remains the source of truth either way. */}
          <section className="rounded-2xl border border-ink-200 bg-white p-5">
            <h2 className="text-base font-semibold text-ink-900">Basket the customer confirmed</h2>
            {items.length > 0 ? (
              <>
                <ul className="mt-3 divide-y divide-ink-100">
                  {items.map((item) => (
                    <li key={item.id} className="flex items-start gap-3 py-2.5 text-sm">
                      <span className="min-w-0 flex-1 break-words font-semibold text-ink-900">
                        {item.name}
                        <SourceBadge source={item.source} />
                      </span>
                      <span className="shrink-0 tabular-nums text-ink-500">
                        &times;{item.quantity}
                      </span>
                      <span className="w-24 shrink-0 text-right font-semibold tabular-nums text-ink-900">
                        {item.line_price_minor === null
                          ? "—"
                          : formatMinorAsCurrency(item.line_price_minor)}
                      </span>
                    </li>
                  ))}
                </ul>
                {itemsSubtotal !== null ? (
                  <p className="mt-3 flex items-baseline justify-between border-t border-ink-200 pt-3 text-sm">
                    <span className="text-ink-500">
                      Listed prices add up to
                      {pricedCount < items.length ? ` (${pricedCount} of ${items.length} priced)` : ""}
                    </span>
                    <span className="font-bold tabular-nums text-ink-900">
                      {formatMinorAsCurrency(itemsSubtotal)}
                    </span>
                  </p>
                ) : null}
                <p className="mt-3 text-xs text-ink-500">
                  Confirmed by the customer, not verified by us. Check it against the cart
                  screenshot below before rebuilding on {submission.comparison_app}.
                </p>
              </>
            ) : (
              <p className="mt-1.5 text-sm text-ink-500">
                No items confirmed. Rebuild the basket from the cart screenshot.
              </p>
            )}
          </section>

          <ExtractionPanel
            submissionId={submission.id}
            cartImageUrl={cartUrl}
            configured={isExtractionConfigured()}
            previous={
              extraction
                ? {
                    id: extraction.id,
                    method: extraction.method,
                    structured: (extraction.structured as StructuredBasket | null) ?? null,
                    confirmedAt: extraction.confirmed_at,
                    ocrConfidence:
                      extraction.ocr_confidence === null ? null : Number(extraction.ocr_confidence),
                  }
                : null
            }
          />

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
            currentTotal={submission.current_total}
            areaName={submission.areas?.name ?? "Dubai"}
            initial={{
              sourceApp: submission.source_app,
              comparisonUrl: submission.comparison_url ?? "",
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
