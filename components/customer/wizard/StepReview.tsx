"use client";

import { useEffect, useMemo } from "react";
import { AlertCircle } from "lucide-react";
import { CURRENCY, OTHER_APP_VALUE } from "@/lib/constants";
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

  const rows: Array<{ label: string; value: string }> = [
    { label: "Ordering from", value: appLabel },
    { label: "Area", value: areaName },
    { label: "Checkout total", value: `${CURRENCY} ${Number(values.currentTotal).toFixed(2)}` },
    { label: "Checkout screenshot", value: files.checkout ? "Added" : "Not added" },
    { label: "Contact", value: maskedContact(values) },
  ];

  return (
    <>
      <h1 className="text-2xl font-extrabold tracking-tight text-ink-900">Check and submit</h1>
      <p className="mt-2 text-base text-ink-600">One last look before we compare it.</p>

      <div className="mt-6 overflow-hidden rounded-2xl border border-ink-200 bg-white">
        <dl className="divide-y divide-ink-100">
          {rows.map((row) => (
            <div key={row.label} className="flex items-start justify-between gap-4 px-4 py-3.5">
              <dt className="text-sm text-ink-500">{row.label}</dt>
              <dd className="text-right text-sm font-semibold text-ink-900">{row.value}</dd>
            </div>
          ))}
          <div className="flex items-start justify-between gap-4 px-4 py-3.5">
            <dt className="text-sm text-ink-500">Cart screenshot</dt>
            <dd>
              {thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={thumbnail}
                  alt="Your cart screenshot"
                  className="h-16 w-16 rounded-lg border border-ink-200 object-cover"
                />
              ) : (
                <span className="text-sm font-semibold text-ink-900">Added</span>
              )}
            </dd>
          </div>
        </dl>
      </div>

      {submitError ? (
        <p
          role="alert"
          className="mt-5 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm font-medium text-rose-800"
        >
          <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{submitError}</span>
        </p>
      ) : null}

      <div className="mt-auto space-y-3 pt-8">
        <Button onClick={onSubmit} loading={submitting} loadingLabel="Sending your order…">
          Submit for comparison
        </Button>
        <Button variant="secondary" onClick={onBack} disabled={submitting}>
          Back
        </Button>
      </div>
    </>
  );
}
