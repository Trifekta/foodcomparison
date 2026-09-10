"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, ChevronRight, MapPin, Minus, Receipt, Store } from "lucide-react";
import { COMPARISON_APP, CURRENCY, OTHER_APP_VALUE } from "@/lib/constants";
import { maskEmail, maskPhone, normalisePhone } from "@/lib/utils/phone";
import { Button } from "@/components/ui/Button";
import { ImageLightbox } from "@/components/ui/ImageLightbox";
import { FoodPhoto } from "@/components/customer/FoodPhoto";
import { ScriptNote, Sparks } from "@/components/customer/Motifs";
import { cn } from "@/lib/utils/cn";
import type { CartItem } from "@/lib/validation/submission";
import type { WizardFiles, WizardValues } from "./types";

interface StepReviewProps {
  values: WizardValues;
  files: WizardFiles;
  /** Already stripped of blank rows by the wizard. */
  items: CartItem[];
  areaName: string;
  submitting: boolean;
  submitError: string | null;
  onSubmit: () => void;
  onBack: () => void;
  /** Jump back to the step that owns a value, from its row on this screen. */
  onEditBasket: () => void;
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
  items,
  areaName,
  submitting,
  submitError,
  onSubmit,
  onBack,
  onEditBasket,
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

  // Which screenshot, if any, is open full size.
  const [zoomed, setZoomed] = useState<"cart" | "checkout" | null>(null);

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

        {/* The screenshots they actually sent. Nothing is read out of them
            automatically - an admin opens them by hand. */}
        <div className="px-4 pb-4">
          <div className="flex items-start gap-3">
          <div className="flex shrink-0 gap-2">
            {cartThumb ? (
              <button
                type="button"
                onClick={() => setZoomed("cart")}
                className="cursor-zoom-in"
                aria-label="View your cart screenshot full size"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={cartThumb}
                  alt="Your cart screenshot"
                  className="h-16 w-16 rounded-xl bg-ink-50 object-cover object-top ring-1 ring-ink-100"
                />
              </button>
            ) : null}
            {checkoutThumb ? (
              <button
                type="button"
                onClick={() => setZoomed("checkout")}
                className="cursor-zoom-in"
                aria-label="View your checkout screenshot full size"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={checkoutThumb}
                  alt="Your checkout screenshot"
                  className="h-16 w-16 rounded-xl bg-ink-50 object-cover object-top ring-1 ring-ink-100"
                />
              </button>
            ) : null}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[1rem] font-extrabold leading-tight text-ink-900">
              {hasCheckoutShot ? "2 screenshots ready" : "1 screenshot ready"}
            </p>
            <p className="mt-0.5 text-[0.85rem] leading-snug text-slate-500">
              Tap to check nothing got cut off.
            </p>
          </div>
          </div>
          <div className="mt-3">
            <StatusPill ok>Cart screenshot added</StatusPill>
          </div>
        </div>

        <div className="border-t border-ink-100" />
        <EditRow
          icon={<Store className="h-5 w-5 text-slate-600" />}
          label="Restaurant"
          value={values.restaurantName.trim()}
          onEdit={onEditBasket}
        />

        {items.length > 0 ? (
          <div className="px-4 pb-4">
            <ul className="divide-y divide-ink-100 rounded-2xl bg-ink-50 px-3.5">
              {items.map((item, index) => (
                <li
                  key={`${index}-${item.name}`}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <span className="min-w-0 flex-1 truncate text-[0.92rem] font-semibold text-ink-900">
                    {item.name}
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-2">
                    <span className="rounded-full bg-white px-2.5 py-0.5 text-[0.78rem] font-bold tabular-nums text-slate-600 ring-1 ring-ink-200">
                      &times;{item.quantity}
                    </span>
                    {item.linePrice ? (
                      <span className="text-[0.88rem] font-extrabold tabular-nums text-ink-900">
                        {CURRENCY} {item.linePrice}
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[0.8rem] text-slate-500">
              {items.length === 1 ? "1 item added" : `${items.length} items added`} — we&apos;ll
              check the rest against your screenshot.
            </p>
          </div>
        ) : null}

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

      <ImageLightbox
        src={zoomed === "cart" ? cartThumb : zoomed === "checkout" ? checkoutThumb : null}
        alt={zoomed === "checkout" ? "Your checkout screenshot, full size" : "Your cart screenshot, full size"}
        open={zoomed !== null}
        onClose={() => setZoomed(null)}
      />

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
      {/* The price challenge: the most prominent element on the screen. */}
      <section className="mt-4 overflow-hidden rounded-3xl bg-linear-to-br from-brand-100 to-brand-200 p-4">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="text-[1.4rem] font-extrabold leading-tight text-ink-900">
              Can {COMPARISON_APP} beat
              <br />
              <span className="marker">{total}?</span>
            </h2>
            <p className="mt-2 text-[0.82rem] leading-snug text-slate-600">
              We&apos;ll rebuild the same food and delivery location, then send you the price.
            </p>
          </div>
          <span aria-hidden="true" className="relative block w-[44%] shrink-0 select-none">
            <FoodPhoto name="bagCluster" className="w-full" />
            <ScriptNote className="absolute -top-1 right-0 text-[0.66rem] leading-tight text-ink-800">
              Same Food
              <br />
              Lower Prices
            </ScriptNote>
          </span>
        </div>

        <div className="mt-4">
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
