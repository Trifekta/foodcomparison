"use client";

import { useEffect, useMemo } from "react";
import { AlertCircle, Check, ChevronRight, MapPin, Minus, Receipt } from "lucide-react";
import { COMPARISON_APP, CURRENCY, OTHER_APP_VALUE } from "@/lib/constants";
import { maskEmail, maskPhone, normalisePhone } from "@/lib/utils/phone";
import { Button } from "@/components/ui/Button";
import { Burger, DeliveryBag, DrinkCup, Fries } from "@/components/customer/FoodArt";
import { ScriptNote, Sparks } from "@/components/customer/Motifs";
import { cn } from "@/lib/utils/cn";
import type { WizardFiles, WizardValues } from "./types";

interface StepReviewProps {
  values: WizardValues;
  files: WizardFiles;
  areaName: string;
  submitting: boolean;
  submitError: string | null;
  onSubmit: () => void;
  onBack: () => void;
  /** Jump back to the step that owns a value, from its row on this screen. */
  onEditArea: () => void;
  onEditContact: () => void;
}

function maskedContact(values: WizardValues): string {
  if (values.contactType === "email") return maskEmail(values.email.trim());
  try {
    return `WhatsApp ${maskPhone(normalisePhone(values.dialCode, values.whatsappNumber).e164)}`;
  } catch {
    return "WhatsApp";
  }
}

/** Green tick pill, or a muted one when the thing is absent. */
function StatusPill({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[0.78rem] font-bold",
        ok ? "bg-chip-green-bg text-chip-green-fg" : "bg-ink-100 text-slate-500",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex h-4 w-4 items-center justify-center rounded-full",
          ok ? "bg-emerald-600 text-white" : "bg-slate-400 text-white",
        )}
      >
        {ok ? <Check className="h-2.5 w-2.5" strokeWidth={4} /> : <Minus className="h-2.5 w-2.5" strokeWidth={4} />}
      </span>
      {children}
    </span>
  );
}

/** Tappable row that returns to the step owning this value. */
function EditRow({
  icon,
  label,
  value,
  onEdit,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onEdit: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onEdit}
      className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-ink-50"
    >
      <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink-50">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.82rem] text-slate-500">{label}</span>
        <span className="block truncate text-[1.02rem] font-extrabold text-ink-900">{value}</span>
      </span>
      <ChevronRight aria-hidden="true" className="h-5 w-5 shrink-0 text-slate-400" />
      <span className="sr-only">Change</span>
    </button>
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
  onEditArea,
  onEditContact,
}: StepReviewProps) {
  const cartThumb = useMemo(
    () => (files.cart ? URL.createObjectURL(files.cart) : null),
    [files.cart],
  );
  const checkoutThumb = useMemo(
    () => (files.checkout ? URL.createObjectURL(files.checkout) : null),
    [files.checkout],
  );

  useEffect(() => {
    if (!cartThumb) return;
    return () => URL.revokeObjectURL(cartThumb);
  }, [cartThumb]);
  useEffect(() => {
    if (!checkoutThumb) return;
    return () => URL.revokeObjectURL(checkoutThumb);
  }, [checkoutThumb]);

  const appLabel =
    values.sourceApp === OTHER_APP_VALUE && values.sourceAppOther.trim()
      ? values.sourceAppOther.trim()
      : values.sourceApp;

  const total = `${CURRENCY} ${Number(values.currentTotal).toFixed(2)}`;
  const hasCheckoutShot = files.checkout !== null;

  return (
    <>
      <h1 className="relative inline-flex items-start text-[1.9rem] font-extrabold leading-tight text-ink-900">
        Check your order
        <Sparks className="ml-1 h-5 w-5 shrink-0" />
      </h1>
      <p className="mt-1 text-[0.95rem] text-slate-600">
        Confirm the details before we request a price.
      </p>

      {/* One card holding everything the customer told us */}
      <section className="mt-4 overflow-hidden rounded-3xl bg-white shadow-[0_2px_18px_rgba(23,23,28,0.06)] ring-1 ring-ink-100">
        <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-4">
          <h2 className="text-[1.2rem] font-extrabold text-ink-900">Your order</h2>
          <span className="inline-flex items-center gap-2 rounded-xl bg-ink-50 py-1.5 pl-1.5 pr-3">
            <span
              aria-hidden="true"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-chip-red-bg text-base font-extrabold text-chip-red-fg"
            >
              {appLabel.charAt(0)}
            </span>
            <span className="text-[0.95rem] font-bold text-ink-900">{appLabel}</span>
          </span>
        </div>

        {/* The screenshots they actually sent. We show these rather than a list
            of items, because nothing is read out of the images in this phase. */}
        <div className="px-4 pb-4">
          <div className="flex items-start gap-3">
          <div className="flex shrink-0 gap-2">
            {cartThumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cartThumb}
                alt="Your cart screenshot"
                className="h-16 w-16 rounded-xl bg-ink-50 object-cover object-top ring-1 ring-ink-100"
              />
            ) : null}
            {checkoutThumb ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={checkoutThumb}
                alt="Your checkout screenshot"
                className="h-16 w-16 rounded-xl bg-ink-50 object-cover object-top ring-1 ring-ink-100"
              />
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[1rem] font-extrabold leading-tight text-ink-900">
              {hasCheckoutShot ? "2 screenshots ready" : "1 screenshot ready"}
            </p>
            <p className="mt-0.5 text-[0.85rem] leading-snug text-slate-500">
              We&apos;ll read the restaurant and items from these.
            </p>
          </div>
          </div>
          <div className="mt-3">
            <StatusPill ok>Cart screenshot added</StatusPill>
          </div>
        </div>

        <div className="border-t border-ink-100" />

        {/* Total. The label is honest about where the number came from. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5 px-4 py-3.5">
          <span className="flex min-w-0 flex-1 basis-[9rem] items-center gap-3">
            <span
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink-50"
            >
              <Receipt className="h-5 w-5 text-slate-600" />
            </span>
            <span className="min-w-0">
              <span className="block text-[0.82rem] text-slate-500">
                {hasCheckoutShot ? "Your checkout total" : "Total you entered"}
              </span>
              <span className="block whitespace-nowrap text-[1.55rem] font-extrabold leading-tight tracking-tight text-ink-900">
                {total}
              </span>
            </span>
          </span>
          <StatusPill ok={hasCheckoutShot}>
            {hasCheckoutShot ? "Checkout screenshot added" : "Checkout screenshot not added"}
          </StatusPill>
        </div>

        <div className="border-t border-ink-100" />
        <EditRow
          icon={<MapPin className="h-5 w-5 text-slate-600" />}
          label="Delivery area"
          value={areaName}
          onEdit={onEditArea}
        />
        <div className="border-t border-ink-100" />
        <EditRow
          icon={
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#25d366] text-[0.6rem] font-black text-white">
              {values.contactType === "email" ? "@" : "W"}
            </span>
          }
          label="Result sent to"
          value={maskedContact(values)}
          onEdit={onEditContact}
        />
      </section>

      {submitError ? (
        <p
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-2xl bg-rose-50 p-3.5 text-sm font-semibold text-rose-800 ring-1 ring-rose-200"
        >
          <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{submitError}</span>
        </p>
      ) : null}

      {/* The price challenge - the most prominent element on the screen */}
      <section className="relative mt-4 overflow-hidden rounded-3xl bg-linear-to-r from-brand-100 to-brand-200 px-4 pb-4 pt-4">
        <div className="relative z-10 max-w-[62%]">
          <h2 className="text-[1.45rem] font-extrabold leading-tight text-ink-900">
            Can {COMPARISON_APP} beat
            <br />
            <span className="marker">{total}?</span>
          </h2>
          <p className="mt-2 text-[0.85rem] leading-snug text-slate-600">
            We&apos;ll rebuild the same food and delivery location, then send you the price.
          </p>
        </div>

        {/* Unbranded delivery bag: no third-party mark is reproduced. */}
        <div aria-hidden="true" className="pointer-events-none absolute right-1 top-3 h-28 w-[42%] select-none">
          <DeliveryBag className="absolute bottom-2 left-[18%] h-[78%] w-auto drop-shadow-sm" />
          <Fries className="absolute bottom-3 left-0 h-[54%] w-auto drop-shadow-sm" />
          <DrinkCup className="absolute bottom-1 right-1 h-[56%] w-auto drop-shadow-sm" />
          <Burger className="absolute -bottom-1 right-3 h-[44%] w-auto drop-shadow" />
          <ScriptNote className="absolute -top-1 right-0 text-[0.68rem] text-ink-800">
            Same Food
            <br />
            Lower Prices
          </ScriptNote>
        </div>

        <div className="relative z-10 mt-4">
          <Button onClick={onSubmit} loading={submitting} loadingLabel="Sending…" arrow>
            Get a {COMPARISON_APP} price
          </Button>
        </div>
      </section>

      <div className="mt-3 flex justify-center">
        <button
          type="button"
          onClick={onBack}
          disabled={submitting}
          className="min-h-11 rounded-full px-6 text-[1rem] font-bold text-slate-600 hover:bg-ink-100 disabled:opacity-50"
        >
          Back
        </button>
      </div>
    </>
  );
}
