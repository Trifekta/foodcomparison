"use client";

import { useEffect, useMemo } from "react";
import { AlertCircle, CheckCircle2, ChevronRight, MapPin } from "lucide-react";
import { COMPARISON_APP, CURRENCY, OTHER_APP_VALUE } from "@/lib/constants";
import { maskEmail, maskPhone, normalisePhone } from "@/lib/utils/phone";
import { Button } from "@/components/ui/Button";
import type { WizardFiles, WizardValues } from "./types";

interface StepReviewProps {
  values: WizardValues;
  files: WizardFiles;
  areaName: string;
  submitting: boolean;
  submitError: string | null;
  onSubmit: () => void;
  onBack: () => void;
}

function maskedContact(values: WizardValues): string {
  if (values.contactType === "email") {
    return `Email ${maskEmail(values.email.trim())}`;
  }
  try {
    return `WhatsApp ${maskPhone(normalisePhone(values.dialCode, values.whatsappNumber).e164)}`;
  } catch {
    return "WhatsApp";
  }
}

/** Small labelled row inside a review card. */
function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="text-sm text-ink-500">{label}</dt>
      <dd className="text-right text-sm font-bold text-ink-900">{value}</dd>
    </div>
  );
}

export function StepReview({
  values,
  files,
  areaName,
  submitting,
  submitError,
  onSubmit,
  onBack,
}: StepReviewProps) {
  const thumbnail = useMemo(
    () => (files.cart ? URL.createObjectURL(files.cart) : null),
    [files.cart],
  );

  useEffect(() => {
    if (!thumbnail) return;
    return () => URL.revokeObjectURL(thumbnail);
  }, [thumbnail]);

  const appLabel =
    values.sourceApp === OTHER_APP_VALUE && values.sourceAppOther.trim()
      ? values.sourceAppOther.trim()
      : values.sourceApp;

  const total = `${CURRENCY} ${Number(values.currentTotal).toFixed(2)}`;

  return (
    <>
      <h1 className="text-[1.75rem] font-extrabold leading-tight text-ink-900">Check your order</h1>
      <p className="mt-1.5 text-[0.95rem] text-ink-500">
        Confirm the details before we request a price.
      </p>

      <div className="mt-5 space-y-3">
        {/* What the customer sent us */}
        <section className="rounded-3xl border border-ink-200 p-4">
          <h2 className="text-sm font-bold text-ink-900">Your order</h2>
          <div className="mt-3 flex items-start gap-3.5">
            {thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thumbnail}
                alt="Your cart screenshot"
                className="h-20 w-20 shrink-0 rounded-xl border border-ink-200 bg-ink-50 object-cover object-top"
              />
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="text-base font-extrabold text-ink-900">{appLabel}</p>
              <p className="mt-0.5 text-sm text-ink-500">Cart screenshot</p>
              <p className="mt-1.5 inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />
                Screenshot added
              </p>
            </div>
          </div>
        </section>

        {/* The total we will compare against */}
        <section className="rounded-3xl border border-ink-200 p-4">
          <h2 className="text-sm font-bold text-ink-900">Your checkout total</h2>
          <p className="mt-2 text-[2rem] font-extrabold leading-none tracking-tight text-ink-900">
            {total}
          </p>
          <p
            className={
              files.checkout
                ? "mt-2 inline-flex items-center gap-1 text-xs font-bold text-emerald-700"
                : "mt-2 text-xs text-ink-400"
            }
          >
            {files.checkout ? (
              <>
                <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />
                Checkout screenshot added
              </>
            ) : (
              "No checkout screenshot — that's fine"
            )}
          </p>
        </section>

        {/* Where and how to reach them */}
        <section className="rounded-3xl border border-ink-200 px-4 py-1.5">
          <dl className="divide-y divide-ink-100">
            <Row
              label="Delivery area"
              value={
                <span className="inline-flex items-center gap-1.5">
                  <MapPin aria-hidden="true" className="h-3.5 w-3.5 text-ink-400" />
                  {areaName}
                </span>
              }
            />
            <Row label="Result sent to" value={maskedContact(values)} />
          </dl>
        </section>
      </div>

      {submitError ? (
        <p
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-sm font-semibold text-rose-800"
        >
          <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{submitError}</span>
        </p>
      ) : null}

      {/* The ask, framed as the question we are actually going to answer. */}
      <section className="mt-5 rounded-3xl bg-brand-200/70 p-4">
        <h2 className="text-[1.05rem] font-extrabold leading-snug text-ink-900">
          Can {COMPARISON_APP} beat {total}?
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-ink-700">
          We&apos;ll rebuild the same food and delivery location, then send you the price.
        </p>
        <div className="mt-3.5">
          <Button
            variant="dark"
            onClick={onSubmit}
            loading={submitting}
            loadingLabel="Sending your order…"
          >
            Get a {COMPARISON_APP} price
            <ChevronRight aria-hidden="true" className="h-4 w-4" />
          </Button>
        </div>
      </section>

      <div className="mt-3">
        <Button variant="ghost" size="md" onClick={onBack} disabled={submitting}>
          Back
        </Button>
      </div>
    </>
  );
}
