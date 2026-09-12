"use client";

import { useEffect, useId, useState } from "react";
import { AlertCircle, Check, ChevronRight, MapPin, Minus, Receipt, Store } from "lucide-react";
import { BRAND_NAME, COMPARISON_APP, CURRENCY, DIAL_CODES } from "@/lib/constants";
import { Button } from "@/components/ui/Button";
import { FieldError } from "@/components/ui/FieldError";
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
  /** Contact errors surface here, because contact is asked here. */
  errors: { whatsappNumber?: string; email?: string };
  onSubmit: () => void;
  onBack: () => void;
  /** Jump back to the step that owns a value, from its row on this screen. */
  onEditBasket: () => void;
  onEditArea: () => void;
  onContactTypeChange: (type: "whatsapp" | "email") => void;
  onDialCodeChange: (code: string) => void;
  onWhatsappNumberChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onMarketingConsentChange: (value: boolean) => void;
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

/**
 * A preview URL for a picked file, released when it is replaced or the screen
 * goes away.
 *
 * The URL is created inside the effect that revokes it, so the two are always
 * the same one. Creating it in a memo beside the effect looks equivalent and is
 * not: this screen mounts with the files already chosen, so any remount that
 * does not re-run the memo - React's Strict Mode double-invoke among them -
 * revokes the URL the <img> is still pointing at, and the customer is shown a
 * broken thumbnail where their own screenshot should be.
 *
 * That makes the state write below deliberate rather than the render-loop
 * mistake the rule is there to catch: it happens once per file, and the file
 * comes from a tap.
 */
function useObjectUrl(file: File | null): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const created = file ? URL.createObjectURL(file) : null;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see above
    setUrl(created);
    return () => {
      if (created) URL.revokeObjectURL(created);
    };
  }, [file]);

  return url;
}

export function StepReview({
  values,
  files,
  items,
  areaName,
  submitting,
  submitError,
  errors,
  onSubmit,
  onBack,
  onEditBasket,
  onEditArea,
  onContactTypeChange,
  onDialCodeChange,
  onWhatsappNumberChange,
  onEmailChange,
  onMarketingConsentChange,
}: StepReviewProps) {
  const phoneId = useId();
  const emailId = useId();
  const consentId = useId();
  const cartThumb = useObjectUrl(files.cart);
  const checkoutThumb = useObjectUrl(files.checkout);

  // Which screenshot, if any, is open full size.
  const [zoomed, setZoomed] = useState<"cart" | "checkout" | null>(null);

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
        <div className="px-4 pb-3 pt-4">
          <h2 className="text-[1.2rem] font-extrabold text-ink-900">Your order</h2>
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
      </section>

      {/* Where to send it. Asked here rather than on a screen of its own: it is
          the last thing between the customer and the answer, and a screen that
          exists only to collect a phone number is where people stop. */}
      <section className="mt-4 rounded-3xl bg-white p-4 shadow-[0_2px_18px_rgba(23,23,28,0.06)] ring-1 ring-ink-100">
        <h2 className="text-[1.1rem] font-extrabold text-ink-900">
          Where should we send your result?
        </h2>
        <p className="mt-1 text-[0.88rem] leading-snug text-slate-600">
          We reply about this request only. Nothing is ordered.
        </p>

        <div className="mt-3">
          {values.contactType === "whatsapp" ? (
            <>
              <label htmlFor={phoneId} className="mb-2 block text-[0.9rem] font-bold text-ink-900">
                WhatsApp number
              </label>
              <div
                className={cn(
                  "flex items-stretch overflow-hidden rounded-2xl border bg-white",
                  "focus-within:outline focus-within:outline-[3px] focus-within:outline-offset-2 focus-within:outline-ink-900",
                  errors.whatsappNumber ? "border-rose-400" : "border-ink-200",
                )}
              >
                <label htmlFor={`${phoneId}-code`} className="sr-only">
                  Country code
                </label>
                <select
                  id={`${phoneId}-code`}
                  value={values.dialCode}
                  onChange={(event) => onDialCodeChange(event.target.value)}
                  className="min-h-14 border-r border-ink-200 bg-ink-50 px-3 text-base font-bold text-ink-800"
                >
                  {DIAL_CODES.map((entry) => (
                    <option key={entry.code} value={entry.code}>
                      {entry.code}
                    </option>
                  ))}
                </select>
                <input
                  id={phoneId}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel-national"
                  placeholder="50 123 4567"
                  value={values.whatsappNumber}
                  onChange={(event) => onWhatsappNumberChange(event.target.value)}
                  aria-describedby={errors.whatsappNumber ? `${phoneId}-error` : undefined}
                  aria-invalid={errors.whatsappNumber ? true : undefined}
                  className="min-h-14 w-full bg-transparent px-3.5 text-base font-semibold text-ink-900 placeholder:font-normal placeholder:text-ink-400 focus:outline-none"
                />
              </div>
              <FieldError id={`${phoneId}-error`} message={errors.whatsappNumber} />
            </>
          ) : (
            <>
              <label htmlFor={emailId} className="mb-2 block text-[0.9rem] font-bold text-ink-900">
                Email address
              </label>
              <input
                id={emailId}
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={values.email}
                onChange={(event) => onEmailChange(event.target.value)}
                aria-describedby={errors.email ? `${emailId}-error` : undefined}
                aria-invalid={errors.email ? true : undefined}
                className={cn(
                  "min-h-14 w-full rounded-2xl border bg-white px-4 text-base font-semibold text-ink-900 placeholder:font-normal placeholder:text-ink-400",
                  errors.email ? "border-rose-400" : "border-ink-200",
                )}
              />
              <FieldError id={`${emailId}-error`} message={errors.email} />
            </>
          )}

          {/* One channel is shown, the other is one tap away. Choosing is work
              too, and almost everyone wants WhatsApp. */}
          <button
            type="button"
            onClick={() =>
              onContactTypeChange(values.contactType === "whatsapp" ? "email" : "whatsapp")
            }
            className="mt-2.5 min-h-9 text-[0.88rem] font-bold text-ink-700 underline underline-offset-4 hover:text-ink-900"
          >
            {values.contactType === "whatsapp" ? "Prefer email?" : "Use WhatsApp instead"}
          </button>
        </div>

        {/*
          Marketing consent is separate from service communication. Submitting a
          comparison lets us reply about THAT request; this box is the only thing
          that opts someone into anything else, and it starts off.
        */}
        <label
          htmlFor={consentId}
          className="mt-3 flex cursor-pointer items-start gap-3 rounded-2xl bg-cream p-3.5 ring-1 ring-sand"
        >
          <input
            id={consentId}
            type="checkbox"
            checked={values.marketingConsent}
            onChange={(event) => onMarketingConsentChange(event.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 rounded accent-ink-900"
          />
          <span className="text-[0.85rem] leading-snug text-ink-600">
            I&apos;d like to hear about future {BRAND_NAME} offers.
          </span>
        </label>
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
