"use client";

import { useEffect, useMemo } from "react";
import { AlertCircle, CheckCircle2, ChevronRight, MapPin, MinusCircle, Send } from "lucide-react";
import { COMPARISON_APP, CURRENCY, OTHER_APP_VALUE } from "@/lib/constants";
import { maskEmail, maskPhone, normalisePhone } from "@/lib/utils/phone";
import { Button } from "@/components/ui/Button";
import { FoodIcon } from "@/components/customer/FoodArt";
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

function Row({
  label,
  value,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <dt className="flex items-center gap-2 text-sm text-ink-500">
        {icon}
        {label}
      </dt>
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
  const hasCheckoutShot = files.checkout !== null;

  return (
    <>
      <h1 className="text-[1.75rem] font-extrabold leading-tight text-ink-900">Check your order</h1>
      <p className="mt-2 text-[0.95rem] text-ink-500">
        Confirm the details before we request a price.
      </p>

      <div className="mt-5 space-y-3">
        {/* What the customer sent us */}
        <section className="overflow-hidden rounded-3xl bg-cream ring-1 ring-sand">
          <div className="flex items-center gap-2 border-b border-sand/70 px-4 py-2.5">
            <FoodIcon name="burger" className="h-5 w-5" />
            <h2 className="text-sm font-bold text-ink-900">Your order</h2>
          </div>
          <div className="flex items-start gap-3.5 p-4">
            {thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thumbnail}
                alt="Your cart screenshot"
                className="h-20 w-20 shrink-0 rounded-xl bg-white object-cover object-top ring-1 ring-sand"
              />
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">
                Ordering from
              </p>
              <p className="text-lg font-extrabold leading-tight text-ink-900">{appLabel}</p>

              <p className="mt-2 flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />
                Cart screenshot added
              </p>
              <p
                className={
                  hasCheckoutShot
                    ? "mt-1 flex items-center gap-1.5 text-xs font-bold text-emerald-700"
                    : "mt-1 flex items-center gap-1.5 text-xs font-semibold text-ink-400"
                }
              >
                {hasCheckoutShot ? (
                  <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />
                ) : (
                  <MinusCircle aria-hidden="true" className="h-3.5 w-3.5" />
                )}
                {hasCheckoutShot ? "Checkout screenshot added" : "Checkout screenshot not added"}
              </p>
            </div>
          </div>
        </section>

        {/* The total we will compare against. Its label is honest about where
            the number came from: we only claim it is backed by a screenshot
            when the customer actually attached one. */}
        <section className="rounded-3xl border border-ink-200 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">
            {hasCheckoutShot ? "Checkout total" : "Total you entered"}
          </p>
          <p className="mt-1 text-[2rem] font-extrabold leading-none tracking-tight text-ink-900">
            {total}
          </p>
          <p
            className={
              hasCheckoutShot
                ? "mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700"
                : "mt-2 inline-flex items-center gap-1.5 rounded-full bg-ink-50 px-2.5 py-1 text-xs font-semibold text-ink-500"
            }
          >
            {hasCheckoutShot ? (
              <>
                <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />
                Confirmed by your checkout screenshot
              </>
            ) : (
              "We'll compare against this amount"
            )}
          </p>
        </section>

        {/* Where and how to reach them */}
        <section className="rounded-3xl border border-ink-200 px-4 py-1">
          <dl className="divide-y divide-ink-100">
            <Row
              label="Delivery area"
              icon={<MapPin aria-hidden="true" className="h-3.5 w-3.5 text-ink-400" />}
              value={areaName}
            />
            <Row
              label="Result sent to"
              icon={<Send aria-hidden="true" className="h-3.5 w-3.5 text-ink-400" />}
              value={maskedContact(values)}
            />
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

      {/* The ask, framed as the question we are about to answer. This is the
          most prominent element on the screen. */}
      <section className="relative mt-5 overflow-hidden rounded-3xl bg-linear-to-br from-brand-300 to-flame-300 p-5">
        <FoodIcon
          name="pizza"
          className="pointer-events-none absolute -right-4 -top-3 h-24 w-24 rotate-12 opacity-25"
        />
        <p className="relative text-xs font-extrabold uppercase tracking-wide text-flame-700">
          Price challenge
        </p>
        <h2 className="relative mt-1 text-[1.35rem] font-extrabold leading-snug tracking-tight text-ink-900">
          Can {COMPARISON_APP} beat {total}?
        </h2>
        <p className="relative mt-1.5 max-w-[85%] text-sm leading-relaxed text-ink-800">
          We&apos;ll rebuild the same restaurant and items for {areaName}, then send you the price.
        </p>
        <div className="relative mt-4">
          <Button variant="dark" onClick={onSubmit} loading={submitting} loadingLabel="Sending…">
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
