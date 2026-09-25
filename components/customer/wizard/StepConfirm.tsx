"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useObjectUrl } from "@/lib/customer/use-object-url";
import { scrollToGuidedTarget } from "@/lib/customer/scroll-to-target";
import { amountSchema } from "@/lib/validation/submission";
import { isNormalisablePhone } from "@/lib/utils/phone";
import {
  AlertCircle,
  ChevronRight,
  Gift,
  Info,
  Loader2,
  MapPin,
  ScanLine,
  Store,
} from "lucide-react";
import type { PublicArea } from "@/types/database";
import {
  BRAND_NAME,
  COMPARISON_APP,
  CURRENCY,
  DIAL_CODES,
  RESULT_PROMISE,
} from "@/lib/constants";
import { Button } from "@/components/ui/Button";
import { FieldError } from "@/components/ui/FieldError";
import { ImageLightbox } from "@/components/ui/ImageLightbox";
import { AmountInput } from "@/components/forms/AmountInput";
import { AreaCombobox } from "@/components/forms/AreaCombobox";
import { FoodPhoto } from "@/components/customer/FoodPhoto";
import { ScriptBubble, ScriptNote } from "@/components/customer/Motifs";
import { cn } from "@/lib/utils/cn";
import { BasketEditor } from "./BasketEditor";
import { StepActions } from "./StepActions";
import {
  itemsNeedAttention,
  type CartItemDraft,
  type ExtractionStatus,
  type ReadTotals,
  type TotalKind,
  type WizardFiles,
  type WizardValues,
} from "./types";

interface StepConfirmProps {
  values: WizardValues;
  files: WizardFiles;
  items: CartItemDraft[];
  areas: PublicArea[];
  extractionStatus: ExtractionStatus;
  readTotals: ReadTotals | null;
  totalsFromCheckout: boolean;
  /** The best figure the screenshots printed, settled or not. */
  readTotal: string | null;
  /** What that figure is - a finished bill, or the food before fees. */
  totalKind: TotalKind;
  /** Whether that total came off the checkout screen rather than the cart. */
  totalFromCheckout: boolean;
  /** The field already holds the number read off one of their screenshots. */
  prefilledFromScreenshot: boolean;
  /**
   * The cart screenshot is still being read AND we are still willing to wait
   * for it. False once the read lands, and false once it has taken long enough
   * that holding the customer here costs more than the read is worth.
   */
  waitingOnRead: boolean;
  submitting: boolean;
  submitError: string | null;
  errors: {
    restaurantName?: string;
    areaId?: string;
    currentTotal?: string;
    newToKeeta?: string;
    whatsappNumber?: string;
  };
  onRestaurantNameChange: (value: string) => void;
  onItemsChange: (items: CartItemDraft[]) => void;
  onAreaChange: (areaId: string) => void;
  onCurrentTotalChange: (value: string) => void;
  onNewToKeetaChange: (value: "yes" | "no") => void;
  onUseReadTotal: () => void;
  onDialCodeChange: (code: string) => void;
  onWhatsappNumberChange: (value: string) => void;
  onMarketingConsentChange: (value: boolean) => void;
  onSubmit: () => void;
}

/**
 * Confirm and check: everything the customer answers, on one screen.
 *
 * This was three - confirm the basket, where and how much, then review. The
 * third of those existed only to read the other two back, which is a screen
 * that asks somebody to check work they did ninety seconds ago and gives them
 * nothing to do but agree.
 *
 * What survived the merge is every part that did work:
 *
 *  - the basket is still shown and still editable, folded behind a summary
 *    that opens itself when there is a reason (see itemsNeedAttention).
 *  - the screenshots are still here as thumbnails that open full size. This is
 *    the only place a customer ever sees what they actually sent, and a
 *    screenshot cut off above the total is the failure that costs a human
 *    admin a chase.
 *  - the total is still theirs to change, and still says where it came from.
 *  - the challenge - "Can Keeta beat AED 71.10?" - is still the close, because
 *    it is the sentence that makes somebody press the button.
 *
 * The one thing genuinely new: the read may still be running when this opens.
 * On the four-screen flow, two screens of walking paid for that latency by
 * accident. Here it is said out loud at the top, the fields below stay usable
 * while it finishes, and the button waits.
 */
export function StepConfirm({
  values,
  files,
  items,
  areas,
  extractionStatus,
  readTotals,
  totalsFromCheckout,
  readTotal,
  totalKind,
  totalFromCheckout,
  prefilledFromScreenshot,
  waitingOnRead,
  submitting,
  submitError,
  errors,
  onRestaurantNameChange,
  onItemsChange,
  onAreaChange,
  onCurrentTotalChange,
  onNewToKeetaChange,
  onUseReadTotal,
  onDialCodeChange,
  onWhatsappNumberChange,
  onMarketingConsentChange,
  onSubmit,
}: StepConfirmProps) {
  const phoneId = useId();
  const consentId = useId();
  const basketPanelId = useId();
  const basketRef = useRef<HTMLElement>(null);
  const areaRef = useRef<HTMLDivElement>(null);
  const keetaRef = useRef<HTMLDivElement>(null);
  const totalRef = useRef<HTMLDivElement>(null);
  const contactRef = useRef<HTMLElement>(null);
  const ctaRef = useRef<HTMLElement>(null);
  const valuesRef = useRef(values);
  const scrollTimerRef = useRef<number | null>(null);

  useEffect(() => {
    valuesRef.current = values;
  }, [values]);

  useEffect(() => () => {
    if (scrollTimerRef.current !== null) window.clearTimeout(scrollTimerRef.current);
  }, []);

  function cancelGuidedScroll() {
    if (scrollTimerRef.current !== null) window.clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = null;
  }

  function guideToNextAnswer(completed: Partial<WizardValues> = {}) {
    cancelGuidedScroll();
    // Let the chosen answer render and the mobile keyboard close first. Read
    // current values when the timer runs, as screenshot extraction may also
    // finish and fill the total during this brief pause.
    scrollTimerRef.current = window.setTimeout(() => {
      scrollTimerRef.current = null;
      const active = document.activeElement;
      if (active instanceof HTMLElement &&
          (active.isContentEditable || active.matches("input:not([type='checkbox']):not([type='radio']), textarea, select"))) return;

      const answers = { ...valuesRef.current, ...completed };
      const target = !answers.areaId
        ? areaRef.current
        : !answers.newToKeeta
          ? keetaRef.current
          : !amountSchema.safeParse(answers.currentTotal).success
            ? totalRef.current
            : !isNormalisablePhone(answers.dialCode, answers.whatsappNumber)
              ? contactRef.current
              : answers.restaurantName.trim().length < 2
                ? basketRef.current
                : ctaRef.current;
      scrollToGuidedTarget(target);
    }, 180);
  }

  function finishTotal(value: string) {
    if (amountSchema.safeParse(value).success) guideToNextAnswer({ currentTotal: value });
  }

  function finishWhatsapp(value: string) {
    if (isNormalisablePhone(valuesRef.current.dialCode, value)) {
      guideToNextAnswer({ whatsappNumber: value });
    }
  }

  const cartThumb = useObjectUrl(files.cart);
  const checkoutThumb = useObjectUrl(files.checkout);
  const [zoomed, setZoomed] = useState<"cart" | "checkout" | null>(null);

  const reading = extractionStatus === "reading";
  const hasCheckoutShot = files.checkout !== null;
  const namedItems = items.filter((item) => item.name.trim() !== "");

  /**
   * Whether the basket panel is open.
   *
   * null means "no opinion yet, follow the rule". Kept as a tri-state rather
   * than seeded once from the rule, because the rule's inputs arrive late: the
   * read finishes after this screen has mounted, and an item it flags as
   * uncertain has to be able to open a panel that was correctly shut a second
   * earlier. Once the customer has opened or closed it themselves, their
   * choice wins and nothing reopens it underneath them.
   */
  const [basketToggled, setBasketToggled] = useState<boolean | null>(null);
  const basketOpensItself =
    values.restaurantName.trim() === "" || itemsNeedAttention({ status: extractionStatus, items });
  /**
   * An error outranks the customer's own choice, and has to.
   *
   * The restaurant field lives inside this panel, so a validation error on it
   * with the panel shut is an error message that is not in the document at all
   * - nothing to read, nothing to scroll to, and the send button apparently
   * doing nothing when it is tapped. Whatever anybody chose earlier, a panel
   * holding an unanswered required field opens.
   */
  const basketOpen = errors.restaurantName ? true : (basketToggled ?? basketOpensItself);

  const total = values.currentTotal ? `${CURRENCY} ${values.currentTotal}` : "";
  // Offered only when the read found something AND it disagrees with what is in
  // the field. Agreement needs no sentence.
  const showReadHint = readTotal !== null && readTotal !== "" && readTotal !== values.currentTotal;

  /**
   * The field holds the food and not the fees.
   *
   * Worth saying plainly, and worth saying every time. The number we compare
   * against is whatever sits in this field, and the price an admin finds on
   * Keeta is always a grand total - so a subtotal left here unremarked does not
   * produce a slightly rough saving, it produces one that is wrong in a
   * predictable direction. The customer is the only person who can close that
   * gap, and they can only do it if they are told it is open.
   */
  const isSubtotal = prefilledFromScreenshot && totalKind === "subtotal" && values.currentTotal === readTotal;

  const totalLabel = isSubtotal
    ? "Your order subtotal"
    : hasCheckoutShot
      ? "Your checkout total"
      : totalKind === "settled" && prefilledFromScreenshot
        ? "Your total paid"
        : "Total you entered";

  return (
    <>
      {/* Heading with the food vignette to its right */}
      <div className="relative">
        <div className="relative z-10 max-w-[58%]">
          <h1 className="text-[1.85rem] font-extrabold leading-tight text-ink-900">
            Confirm and check
          </h1>
          <p className="mt-1.5 text-[0.95rem] leading-relaxed text-slate-600">
            Review your order details before we check {COMPARISON_APP}&apos;s price.
          </p>
          <span aria-hidden="true" className="mt-1.5 block h-[3px] w-16 rounded-full bg-brand-400" />
        </div>

        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-2 -right-2 h-36 w-[42%] select-none"
        >
          <span className="absolute inset-x-0 top-2 bottom-5 rounded-[2.5rem] bg-linear-to-br from-brand-100/80 to-beige" />
          <FoodPhoto name="bowl" eager className="absolute bottom-2 right-3 w-[70%]" />
          <ScriptBubble className="absolute right-0 top-0 text-[0.66rem]">
            Good
            <br />
            Food Nearby
          </ScriptBubble>
        </div>
      </div>

      {/* The read, said out loud. It used to be covered by two screens of
          walking; now it is a banner, and the fields below stay usable while
          it finishes. */}
      <div aria-live="polite" className="mt-4 empty:mt-0">
        {reading ? (
          <div className="flex items-start gap-2.5 rounded-2xl bg-chip-green-bg px-3.5 py-3 text-chip-green-fg">
            <Loader2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
            <p className="text-sm leading-snug">
              <span className="font-bold">We&apos;re reading your order…</span> You can fill in the
              details below while we finish.
            </p>
          </div>
        ) : null}
        {extractionStatus === "applied" ? (
          <p className="flex items-start gap-2.5 rounded-2xl bg-chip-green-bg px-3.5 py-3 text-sm leading-snug text-chip-green-fg">
            <ScanLine aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <span className="font-bold">This is what we read from your screenshot.</span> Check it
              and fix anything that&apos;s wrong.
            </span>
          </p>
        ) : null}
      </div>

      <div className="mt-4 space-y-4">
        {/* Order summary, with the basket folded in behind it */}
        <section ref={basketRef} data-guided-scroll="basket" className="scroll-mt-24 overflow-hidden rounded-3xl bg-white shadow-[0_2px_18px_rgba(23,23,28,0.06)] ring-1 ring-ink-100">
          <button
            type="button"
            onClick={() => setBasketToggled(!basketOpen)}
            aria-expanded={basketOpen}
            aria-controls={basketPanelId}
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-ink-50"
          >
            <span
              aria-hidden="true"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100"
            >
              <Store className="h-5 w-5 text-ink-900" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[1.05rem] font-extrabold text-ink-900">
                {values.restaurantName.trim() || (reading ? "Reading your screenshot…" : "Add your restaurant")}
              </span>
              <span className="block text-[0.85rem] text-slate-500">
                {namedItems.length > 0
                  ? `${namedItems.length} ${namedItems.length === 1 ? "item" : "items"} detected`
                  : reading
                    ? "Checking for items…"
                    : "No items read — add them if you like"}
              </span>
            </span>
            <span className="inline-flex shrink-0 items-center gap-1 text-[0.85rem] font-bold text-ink-800">
              {basketOpen ? "Hide" : "View or edit items"}
              <ChevronRight
                aria-hidden="true"
                className={cn("h-4 w-4 transition-transform", basketOpen && "rotate-90")}
              />
            </span>
          </button>

          {basketOpen ? (
            <div id={basketPanelId} className="border-t border-ink-100 px-4 pb-4 pt-4">
              <BasketEditor
                restaurantName={values.restaurantName}
                items={items}
                restaurantError={errors.restaurantName}
                extractionStatus={extractionStatus}
                readTotals={readTotals}
                totalsFromCheckout={totalsFromCheckout}
                onRestaurantNameChange={onRestaurantNameChange}
                onItemsChange={onItemsChange}
              />
            </div>
          ) : null}

          {/* The screenshots they actually sent. The only place anybody checks
              that nothing got cut off before an admin has to chase it. */}
          <div className="border-t border-ink-100 px-4 py-3.5">
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
                      className="h-14 w-14 rounded-xl bg-ink-50 object-cover object-top ring-1 ring-ink-100"
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
                      className="h-14 w-14 rounded-xl bg-ink-50 object-cover object-top ring-1 ring-ink-100"
                    />
                  </button>
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[0.95rem] font-extrabold leading-tight text-ink-900">
                  {hasCheckoutShot ? "2 screenshots added" : "1 screenshot added"}
                </p>
                <p className="mt-0.5 text-[0.82rem] leading-snug text-slate-500">
                  {hasCheckoutShot
                    ? "Tap to view or check nothing got cut off."
                    : "Tap to check nothing got cut off. Without a checkout screenshot we can't verify your fees."}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Delivery area - the required lookup, first, and never buried under a
            variable-length field somebody can scroll straight past. */}
        <div ref={areaRef} data-guided-scroll="area" className="scroll-mt-24 rounded-3xl bg-linear-to-b from-brand-100 to-beige p-3.5">
          <div className="mb-2.5 flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-300"
            >
              <MapPin className="h-4.5 w-4.5 text-ink-900" />
            </span>
            <span className="text-[1.02rem] font-extrabold text-ink-900">Your delivery area</span>
          </div>
          <AreaCombobox
            label="Your delivery area"
            hideLabel
            areas={areas}
            value={values.areaId}
            onChange={(areaId) => {
              onAreaChange(areaId);
              if (areaId) guideToNextAnswer({ areaId });
              else cancelGuidedScroll();
            }}
            error={errors.areaId}
            /* Said out loud because people answer the question they think was
               asked. Somebody at work ordering dinner home reads "your area" as
               where they are standing, and the wrong area is not a slightly
               wrong delivery fee - it can put the restaurant outside Keeta's
               range, which comes back as "not available" and sends them back to
               the app they came from. A false no is the worst answer this
               product can give, and one line prevents most of them. */
            hint="Where the food is going — not where you are right now."
          />
        </div>

        {/* New to Keeta - changes what the admin should expect to find, so it
            belongs with the things that shape the comparison. Deliberately
            unanswered until they answer it: a pre-selected "no" is not an
            answer, and this feeds the new-customer discount check. */}
        <div
          ref={keetaRef}
          data-guided-scroll="keeta"
          className="scroll-mt-24 rounded-3xl bg-linear-to-b from-brand-100 to-beige p-3.5"
          data-invalid={errors.newToKeeta ? "true" : undefined}
          tabIndex={-1}
        >
          <div className="mb-2.5 flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-300"
            >
              <Gift className="h-4.5 w-4.5 text-ink-900" />
            </span>
            <span className="text-[1.02rem] font-extrabold text-ink-900">
              New to {COMPARISON_APP}?
            </span>
          </div>
          <p className="mb-2.5 text-sm leading-snug text-slate-600">
            First orders on {COMPARISON_APP} can come with a discount — we&apos;ll check if yours
            qualifies once we have a price.
          </p>
          <div className="flex gap-2.5" role="group" aria-label={`Are you new to ${COMPARISON_APP}?`}>
            {(["yes", "no"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={values.newToKeeta === option}
                onClick={() => {
                  onNewToKeetaChange(option);
                  guideToNextAnswer({ newToKeeta: option });
                }}
                className={cn(
                  "min-h-11 flex-1 rounded-full text-sm font-bold capitalize transition-colors",
                  values.newToKeeta === option
                    ? "bg-ink-900 text-white"
                    : "bg-white text-ink-700 ring-1 ring-ink-200 hover:bg-ink-50",
                )}
              >
                {option}
              </button>
            ))}
          </div>
          <FieldError id="new-to-keeta-error" message={errors.newToKeeta} />
        </div>

        {/* The total. Directly editable, and honest about where it came from -
            this is the one number the entire product measures a saving
            against. */}
        <div ref={totalRef} data-guided-scroll="total" className="scroll-mt-24">
          <div className="rounded-3xl bg-linear-to-b from-brand-100 to-beige p-3.5">
            <AmountInput
              label={totalLabel}
              scale="lg"
              value={values.currentTotal}
              onChange={(event) => {
                cancelGuidedScroll();
                onCurrentTotalChange(event.target.value);
              }}
              onBlur={(event) => finishTotal(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  event.currentTarget.blur();
                }
              }}
              error={errors.currentTotal}
            />
          </div>

          {prefilledFromScreenshot && isSubtotal ? (
            <p className="mt-3 flex items-start gap-2 rounded-2xl bg-flame-50 px-3.5 py-3 text-sm leading-snug text-ink-700 ring-1 ring-flame-200">
              <ScanLine aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-flame-500" />
              <span>
                <span className="font-bold">This is your food subtotal.</span> Your screenshot
                didn&apos;t show delivery or service fees, so add them for an exact comparison — or
                send the checkout screen and we&apos;ll read them.
              </span>
            </p>
          ) : prefilledFromScreenshot ? (
            <p className="mt-3 flex items-start gap-2 rounded-2xl bg-chip-green-bg px-3.5 py-3 text-sm leading-snug text-chip-green-fg">
              <ScanLine aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Taken from your {totalFromCheckout ? "checkout screenshot" : "screenshot"}. Change
                it if it doesn&apos;t match.
              </span>
            </p>
          ) : null}

          {/* The disagreement. This is what keeps a typed total honest: they
              may have entered it on the upload screen before the read landed,
              and the autofill will never overwrite something a person typed -
              so the only way they hear about a number we read and they did not
              is if we say it. */}
          {showReadHint ? (
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-chip-green-bg px-3.5 py-3">
              <p className="flex min-w-0 flex-1 items-start gap-2 text-sm leading-snug text-chip-green-fg">
                <ScanLine aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  We found{" "}
                  <span className="font-extrabold tabular-nums">
                    {CURRENCY} {readTotal}
                  </span>{" "}
                  {totalKind === "subtotal" ? "as the subtotal on" : "in"} your{" "}
                  {totalFromCheckout ? "checkout screenshot" : "screenshot"}.
                </span>
              </p>
              <button
                type="button"
                onClick={() => {
                  onUseReadTotal();
                  if (readTotal) finishTotal(readTotal);
                }}
                className="min-h-9 shrink-0 rounded-full bg-white px-3.5 text-sm font-bold text-ink-900 ring-1 ring-emerald-200 hover:bg-emerald-50"
              >
                Use {CURRENCY} {readTotal} instead
              </button>
            </div>
          ) : null}

          <p className="mt-3 flex items-start gap-2 rounded-2xl bg-flame-50 p-3.5 text-sm leading-relaxed text-ink-600">
            <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-flame-500" />
            <span>
              {isSubtotal
                ? "We compare against this number, and Keeta's price will include its own fees — so a subtotal makes the saving look smaller than it is."
                : prefilledFromScreenshot
                  ? "This is the number we compare against, so it's worth a glance before you send."
                  : hasCheckoutShot
                    ? "We'll cross-check this against the checkout screenshot you added."
                    : "Include delivery fees and any discounts — this is the number we compare against."}
            </span>
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            cancelGuidedScroll();
            scrollToGuidedTarget(contactRef.current);
          }}
          className="min-h-11 text-sm font-bold text-ink-800 underline underline-offset-4"
        >
          How will I get my result?
        </button>

        {/* Optional result notifications */}
        <section ref={contactRef} data-guided-scroll="contact" className="scroll-mt-24 rounded-3xl bg-white p-4 shadow-[0_2px_18px_rgba(23,23,28,0.06)] ring-1 ring-ink-100">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[1.1rem] font-extrabold text-ink-900">
              <label htmlFor={phoneId}>WhatsApp number</label>
            </h2>
            <span className="rounded-full bg-chip-green-bg px-2.5 py-1 text-xs font-bold text-chip-green-fg">
              Recommended
            </span>
          </div>
          <p id={`${phoneId}-hint`} className="mt-1 text-[0.88rem] leading-snug text-slate-600">
            Get your comparison result on WhatsApp so you don&apos;t need to keep this page open.
          </p>

          <div className="mt-3">
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
                onChange={(event) => {
                  cancelGuidedScroll();
                  onDialCodeChange(event.target.value);
                }}
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
                onChange={(event) => {
                  cancelGuidedScroll();
                  onWhatsappNumberChange(event.target.value);
                }}
                onBlur={(event) => finishWhatsapp(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    event.currentTarget.blur();
                  }
                }}
                aria-describedby={`${phoneId}-hint${errors.whatsappNumber ? ` ${phoneId}-error` : ""}`}
                aria-invalid={errors.whatsappNumber ? true : undefined}
                className="min-h-14 min-w-0 w-full bg-transparent px-3.5 text-base font-semibold text-ink-900 placeholder:font-normal placeholder:text-ink-400 focus:outline-none"
              />
            </div>
            <FieldError id={`${phoneId}-error`} message={errors.whatsappNumber} />
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
      </div>

      <ImageLightbox
        src={zoomed === "cart" ? cartThumb : zoomed === "checkout" ? checkoutThumb : null}
        alt={
          zoomed === "checkout"
            ? "Your checkout screenshot, full size"
            : "Your cart screenshot, full size"
        }
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

      {/* The challenge: the most prominent element on the screen, and the
          sentence that makes somebody press the button. */}
      <section ref={ctaRef} data-guided-scroll="cta" className="scroll-mt-24 mt-4 overflow-hidden rounded-3xl bg-linear-to-br from-brand-100 to-brand-200 p-4">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="text-[1.4rem] font-extrabold leading-tight text-ink-900">
              Can {COMPARISON_APP} beat
              {total ? (
                <>
                  <br />
                  <span className="marker">{total}?</span>
                </>
              ) : (
                <> your total?</>
              )}
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
      </section>

      <StepActions>
        <Button
          onClick={() => {
            cancelGuidedScroll();
            onSubmit();
          }}
          loading={submitting}
          loadingLabel="Sending…"
          arrow
        >
          Get a {COMPARISON_APP} price
        </Button>
        <p className="mt-2.5 text-center text-[0.9rem] font-semibold text-slate-500">
          {waitingOnRead
            ? "We're reading your screenshot in the background. You can submit now or wait for the details to fill in."
            : `Usually ${RESULT_PROMISE}. Nothing is ordered.`}
        </p>
      </StepActions>
    </>
  );
}
