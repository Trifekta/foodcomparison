"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { StepActions } from "./StepActions";
import { ImageUpload } from "@/components/forms/ImageUpload";
import { AmountInput } from "@/components/forms/AmountInput";
import { FoodPhoto } from "@/components/customer/FoodPhoto";
import { ScriptBubble, ScriptNote, Sparks } from "@/components/customer/Motifs";
import { ArrowRight, Camera, Smartphone } from "lucide-react";
import { LastOrderBanner } from "@/components/customer/LastOrderBanner";
import { ScrollDepth } from "@/components/customer/ScrollDepth";
import { FoodAppLinks } from "./FoodAppLinks";
import { track } from "@/lib/analytics/track";
import { captureAttribution } from "@/lib/analytics/attribution";
import { FOOD_APPS } from "@/lib/customer/food-apps";
import { scrollToGuidedTarget } from "@/lib/customer/scroll-to-target";
import type { ExtractionStatus, TotalKind } from "./types";
import { breakdownLabels, calculateManualTotal, type Breakdown, type ManualTotalState } from "@/lib/calculations/manual-total";

interface StepUploadProps {
  cartFile: File | null;
  checkoutFile: File | null;
  /** The first screenshot is still being read, so we cannot say yet. */
  cartReading: boolean;
  /** It carried a printed final total beside its fees - nothing else is needed. */
  cartSettlesTheBill: boolean;
  /** It was read in full and came back without one - now we know, not guess. */
  cartConfirmedShort: boolean;
  /**
   * They tapped one of the food-app links and have just come back. Set only by
   * that round trip - never by an ordinary tab switch - so the greeting below
   * only ever appears for somebody it is actually true of.
   */
  returnedFromApp: boolean;
  /**
   * That return brought typed fields back with it. False for the visit this
   * flow is built around - an advert click who leaves from an empty step one -
   * where there was nothing to keep and saying otherwise is noise.
   */
  restoredProgress: boolean;
  /** `original` is the untouched file, before it was compressed for upload. */
  onCartChange: (file: File | null, original?: File | null) => void;
  onCheckoutChange: (file: File | null, original?: File | null) => void;
  /**
   * Fires the instant a file is chosen, ahead of onCartChange/onCheckoutChange
   * - which wait on the display copy to finish downscaling. The read wants the
   * original bytes anyway, so starting it here rather than there is most of
   * where "the emphasis feels slow" actually goes.
   */
  onCartPicked: (file: File) => void;
  onCheckoutPicked: (file: File) => void;
  /**
   * The final payable amount, typed here rather than photographed.
   *
   * The same react-hook-form field the confirm step edits, which is the whole
   * reason this can live on two screens at once for free - and why a number
   * typed here is still there, and still changeable, one screen later.
   */
  manualTotal: string;
  manualState: ManualTotalState;
  onManualStateChange: (state: ManualTotalState) => void;
  readSubtotal: string;
  /** What the read offered, so this card never calls a subtotal a final total. */
  totalKind: TotalKind;
  /**
   * How the SECOND screenshot's own read is going.
   *
   * Everything else on this slot is decided by what the CART read found, which
   * is the right answer to "should we ask for a checkout screen" and the wrong
   * answer to "what happened to the one you just gave us". Without this the
   * slot goes on asking for a file it is already holding.
   */
  checkoutStatus: ExtractionStatus;
  /** The field holds a figure we read, rather than one they typed. */
  prefilledFromScreenshot: boolean;
  onManualTotalChange: (value: string) => void;
  /** Only ever a format complaint: this field is optional on this screen. */
  totalError?: string;
  error: string | null;
  onContinue: () => void;
}

/**
 * One screenshot, and a second one only where the app needs it.
 *
 * Which is not a thing this screen can know in advance. Talabat, noon and Keeta
 * print the payment summary under the items on the cart page - discount,
 * delivery, service fee and the final total, all on the screen somebody is
 * already looking at - so one screenshot from any of those three settles the
 * bill completely. Deliveroo puts the money on a separate screen. Asking
 * everybody for two up front taxes the majority for the minority; asking for
 * one and comparing against an item subtotal is the worse mistake in the other
 * direction.
 *
 * The checkout slot is emphasized and Recommended as soon as a valid cart
 * is picked, before downscaling or reading finishes. It stays emphasized
 * unless it is filled or the cart read confirms a settled total; a settled
 * cart downgrades it to the quiet Optional state.
 *
 * Each slot carries an (i) to a drawing of a good screenshot. Behind an icon
 * rather than on the page: this is where somebody weighs the wait against the
 * effort of finding a screenshot, and a screen that lectures them there costs
 * more uploads than a bad screenshot does.
 */
export function StepUpload({
  cartFile,
  checkoutFile,
  cartReading,
  cartSettlesTheBill,
  cartConfirmedShort,
  returnedFromApp,
  restoredProgress,
  onCartChange,
  onCheckoutChange,
  onCartPicked,
  onCheckoutPicked,
  manualTotal,
  manualState,
  onManualStateChange,
  readSubtotal,
  totalKind,
  checkoutStatus,
  prefilledFromScreenshot,
  onManualTotalChange,
  totalError,
  error,
  onContinue,
}: StepUploadProps) {
  // Whether a new cart screenshot has been picked on this visit. Local, not
  // read from cartFile: cartFile only updates once the display copy finishes
  // downscaling, and a slow phone on a big screenshot is exactly the case the
  // read's own latency fix (onFilePicked, ahead of that same downscale) exists
  // for. The banner should disappear on the same signal, not lag behind it.
  const [uploadStarted, setUploadStarted] = useState(false);
  const [cartPicked, setCartPicked] = useState(false);
  const [checkoutPicked, setCheckoutPicked] = useState(false);
  const hasCartScreenshot = cartFile !== null || cartPicked;
  const emphasizeCheckout = hasCartScreenshot && checkoutFile === null && !checkoutPicked && !cartSettlesTheBill;
  const [showBreakdownErrors, setShowBreakdownErrors] = useState(false);
  const [forkChoice, setForkChoice] = useState<"none" | "upload" | "app">(
    returnedFromApp ? "upload" : "none",
  );
  const forkChoiceRef = useRef(forkChoice);
  const checkoutUploadRef = useRef<HTMLDivElement>(null);
  const checkoutScrollRequested = useRef(false);

  const forkTargetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (forkChoice === "none" || cartFile) return;
    const frame = window.requestAnimationFrame(() => scrollToGuidedTarget(forkTargetRef.current));
    return () => window.cancelAnimationFrame(frame);
  }, [forkChoice, cartFile]);

  // The picker is revealed by a deliberate choice. Preserve the old fork event when
  // someone opens it, and also when a file is supplied by drag-and-drop or a
  // restored browser's file input, without counting the same choice twice.
  const chooseUpload = () => {
    if (forkChoiceRef.current !== "upload") track("fork_have_screenshot");
    forkChoiceRef.current = "upload";
    setForkChoice("upload");
  };

  // Reveal and guide to checkout at file-pick time, before downscaling finishes.
  // Keep the active cart picker mounted until its processed file arrives.
  // A restored draft or a later cart replacement must not move the page.
  useEffect(() => {
    if (!hasCartScreenshot || !checkoutScrollRequested.current) return;
    const frame = window.requestAnimationFrame(() => {
      checkoutScrollRequested.current = false;
      scrollToGuidedTarget(checkoutUploadRef.current);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [hasCartScreenshot]);

  // The field is holding what we read, and what we read was the food without
  // its fees. Only while that number is still the one in the field - the
  // moment they type over it, it is their figure and not our reading.
  // What the field is holding, and only while it is still OUR figure - the
  // moment they type over it, it is theirs and neither of these is true.
  const subtotalOnly = prefilledFromScreenshot && totalKind === "subtotal";
  const settledFill = prefilledFromScreenshot && totalKind === "settled";

  // Asked and answered. Which screenshot settled the bill does not matter here;
  // that the customer has already given us one does.
  const checkoutAnswered = checkoutFile !== null && checkoutStatus !== "reading";

  /**
   * Whether this card is still offering a way out, or holding a figure.
   *
   * It is a question - "Don't have a checkout screenshot?" - only while nobody
   * has given us one and nothing has been read. Every other state names the
   * number it is holding, and then the field below must NOT repeat that name:
   * the heading has said it, one line up.
   */
  const askingForOne =
    !cartSettlesTheBill && !settledFill && !subtotalOnly && checkoutFile === null;
  const fieldLabel = subtotalOnly ? "Your order subtotal" : "Your final total";
  const canCalculate = checkoutFile === null && ((!cartSettlesTheBill && !settledFill) ||
    (manualState.mode === "breakdown" && manualState.parts !== null));
  const breakdownMode = canCalculate && (manualState.mode === "breakdown" ||
    (manualState.mode === null && (!manualTotal || subtotalOnly)));
  const parts = manualState.parts ?? { subtotal: readSubtotal, delivery: "", service: "", discount: "" };
  const calculation = calculateManualTotal(parts);

  function changePart(key: keyof Breakdown, value: string) {
    const next = { ...parts, [key]: value };
    onManualStateChange({ mode: "breakdown", parts: next });
    onManualTotalChange(calculateManualTotal(next).total);
  }

  // Start fetching the reading engine now, while they are in their gallery
  // choosing a photo. Waiting until they have chosen puts several megabytes
  // directly in front of the screen meant to impress them.
  useEffect(() => {
    let cancelled = false;
    void import("@/lib/ocr/browser").then(({ warmOcr }) => {
      if (!cancelled) warmOcr("customer");
    }).catch(() => {
      // Warming the optional reader may fail in an embedded browser.
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Attribution is captured every time we return to the upload screen, but it
  // is a no-op if already captured by the landing page or on a previous visit.
  // The wizard_started event itself is now tracked in CompareWizard on the first
  // visit only, so it does not fire again if returning from a food app.
  useEffect(() => {
    captureAttribution();
  }, []);

  return (
    <>
      {/* Mounted on this step alone, so its reading means "how far down the
          upload screen", not "how far down whichever step they were on". It
          sends when this unmounts, which is what advancing past it looks
          like. */}
      <ScrollDepth />

      {/* Keep the promise visible, but compress it on small phones so the
          upload box remains in the initial viewport. */}
      <div className="relative rounded-3xl bg-linear-to-r from-brand-100 to-beige px-4 py-4 max-[389px]:py-0">
        <div className="relative z-10 max-w-[44%]">
          <ScriptNote underline className="text-[1.35rem] text-ink-900 max-[389px]:text-[1.05rem]">
            Same Food
            <br />
            Lower Prices
          </ScriptNote>
          <p className="mt-2 text-[0.82rem] font-semibold leading-snug text-slate-600 max-[389px]:mt-1 max-[389px]:text-[0.7rem]">
            Upload. Compare.
            <br />
            Save more.
          </p>
        </div>
        <FoodPhoto
          name="spread"
          eager
          className="pointer-events-none absolute right-0 top-1/2 w-[62%] -translate-y-1/2 select-none max-[389px]:w-[56%]"
        />
        <ScriptBubble className="absolute -right-1 -top-2 z-10 text-[0.64rem] leading-tight max-[389px]:text-[0.5rem]">
          Good
          <br />
          Deals Ahead <span aria-hidden="true">&hearts;</span>
        </ScriptBubble>
      </div>

      {/* Back from a food app, screenshot in hand. Stays put until they pick
          one rather than fading on a timer: it is not a notification, it is
          the answer to "am I in the right place and did I lose anything". */}
      {returnedFromApp && !uploadStarted ? (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="text-[0.95rem] font-bold text-emerald-900">
            Welcome back — upload your screenshot
          </p>
          {restoredProgress ? (
            <p className="mt-0.5 text-[0.82rem] leading-snug text-emerald-800">
              Everything you had entered is still here.
            </p>
          ) : null}
        </div>
      ) : null}

      <h1 className="relative mt-4 inline-flex items-start text-[1.9rem] font-extrabold leading-tight text-ink-900 max-[389px]:mt-3">
        Upload your order
        <Sparks className="ml-1 h-5 w-5 shrink-0" />
      </h1>
      <p className="mt-1.5 text-[0.95rem] leading-relaxed text-slate-600">
        {cartSettlesTheBill
          ? "Your screenshot shows the total already — you're set. Add the checkout screen only if you want to."
          : cartConfirmedShort
            ? "Your cart screenshot doesn't show a total — add the checkout screen below for an exact comparison."
            : "Upload your cart from Talabat, Careem, Deliveroo, Noon Food, or Smiles — we’ll check if it’s cheaper on Keeta."}
      </p>

      {/* The supplied marks identify the apps this screenshot may come from;
          they are labels here, not links that could take a ready customer away. */}
      {!cartFile && (
        <ul aria-label="Supported food apps" className="mt-3 grid grid-cols-5 gap-1.5 text-center max-[389px]:mt-2">
          {FOOD_APPS.map(({ name, logo }) => (
            <li key={name} className="min-w-0">
              {/* Supplied app artwork, shown without recreating either mark. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logo} alt="" width={52} height={52} className="mx-auto h-11 w-11 rounded-xl object-cover min-[390px]:h-12 min-[390px]:w-12" />
              <span className="mt-1 block text-[0.68rem] leading-tight text-ink-800">{name}</span>
            </li>
          ))}
        </ul>
      )}

      {!cartFile && (
        <div className="mt-5">
          <h2 className="mb-3 text-lg font-extrabold text-ink-900">
            Choose one to get started <span className="text-brand-500">↓</span>
          </h2>
          <button
            type="button"
            onClick={chooseUpload}
            aria-expanded={forkChoice === "upload"}
            aria-controls="upload-choice"
            className="w-full rounded-3xl border border-ink-200 bg-white p-3 text-left transition-colors hover:border-brand-400 focus-visible:outline-2 focus-visible:outline-brand-500"
          >
            <span className="flex items-center gap-3">
              <span aria-hidden="true" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-cream">
                <Camera className="h-7 w-7" />
              </span>
              <span className="min-w-0">
                <span className="block text-base font-extrabold text-ink-900">Already have a screenshot?</span>
                <span className="mt-1 block text-sm text-slate-600">Upload your cart screenshot now.</span>
              </span>
            </span>
            <span className="mt-3 flex min-h-12 items-center gap-3 rounded-2xl bg-brand-400 px-4 py-3 font-extrabold text-ink-900">
              <Camera aria-hidden="true" className="h-5 w-5 shrink-0" />
              Tap here to upload
              <ArrowRight aria-hidden="true" className="ml-auto h-5 w-5 shrink-0" />
            </span>
          </button>
          {forkChoice === "upload" && (
            <div id="upload-choice" ref={forkTargetRef} data-guided-scroll="upload" className="mt-3 scroll-mt-24">
              <ImageUpload
                step={1}
                label="Cart screenshot"
                hint="Restaurant and selected items"
                helper="Make sure your restaurant name and ordered items are visible."
                requirement="required"
                art="cartDoc"
                example="cart"
                direct
                onOpenPicker={chooseUpload}
                file={cartFile}
                onChange={(file, original) => {
                  setCartPicked(false);
                  onCartChange(file, original);
                }}
                onFilePicked={(file) => {
                  chooseUpload();
                  setUploadStarted(true);
                  checkoutScrollRequested.current = true;
                  setCartPicked(true);
                  track("cart_uploaded");
                  onCartPicked(file);
                }}
                error={error}
              />

            </div>
          )}

          <button
            type="button"
            onClick={() => {
              if (forkChoiceRef.current !== "app") track("fork_need_to_take");
              forkChoiceRef.current = "app";
              setForkChoice("app");
            }}
            aria-expanded={forkChoice === "app"}
            aria-controls="food-app-choice"
            className={`mt-3 flex w-full items-center gap-3 rounded-2xl border bg-white p-3 text-left transition-colors ${
              forkChoice === "app" ? "border-brand-500" : "border-ink-200 hover:border-brand-300"
            }`}
          >
            <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-cream">
              <Smartphone className="h-6 w-6 text-brand-600" />
            </span>
            <span className="min-w-0">
              <span className="block text-[0.95rem] font-extrabold text-ink-900">No screenshot yet?</span>
              <span className="mt-0.5 block text-[0.82rem] leading-snug text-slate-600">
                Tap to choose your food app ↓
              </span>
            </span>
          </button>

          {forkChoice === "app" && (
            <div id="food-app-choice" ref={forkTargetRef} data-guided-scroll="food-apps" className="mt-3 scroll-mt-24 space-y-3 rounded-3xl border border-brand-400 bg-cream/40 p-3">
              <p className="text-[0.88rem] leading-snug text-slate-600">
                No Keeta screenshot needed — we check Keeta for you.
              </p>
              <FoodAppLinks />
            </div>
          )}
        </div>
      )}

      {/* Full upload flow once a cart screenshot exists. */}
      {hasCartScreenshot && (
        <div className="mt-4 space-y-3">
          {cartFile ? <ImageUpload
            step={1}
            label="Cart screenshot"
            hint="Restaurant and selected items"
            helper="Make sure your restaurant name and ordered items are visible."
            requirement="required"
            art="cartDoc"
            example="cart"
            file={cartFile}
            onChange={(file, original) => {
              setCartPicked(false);
              onCartChange(file, original);
            }}
            onFilePicked={(file) => {
              setUploadStarted(true);
              setCartPicked(true);
              track("cart_uploaded");
              onCartPicked(file);
            }}
            error={error}
          /> : null}

          <div ref={checkoutUploadRef} data-guided-scroll="checkout" className="scroll-mt-24">
            <ImageUpload
              step={2}
              label="Checkout total"
              hint={
                checkoutFile
                  ? checkoutStatus === "reading"
                    ? "Reading this screenshot…"
                    : checkoutStatus === "applied"
                      ? "We read your total from this one"
                      : "No total found on this one"
                  : cartSettlesTheBill
                    ? "We found your final total already — the checkout screenshot is optional."
                    : cartConfirmedShort
                      ? "Your total wasn't on the first screenshot"
                      : "Add your checkout screenshot for the most accurate comparison."
              }
              helper={
                checkoutAnswered
                  ? checkoutStatus === "applied"
                    ? "Got it — your total below now comes from this screenshot."
                    : "We couldn't find a total on this one. Check nothing got cut off, or type your total below."
                  : checkoutFile
                    ? "Reading it now — your total will fill in below."
                    : cartSettlesTheBill
                      ? "Your first screenshot already showed the fees and total, so you can skip this."
                      : cartConfirmedShort && !cartReading
                        ? "Your cart screenshot doesn't show the final total — add the checkout screen for an exact comparison."
                        : "It shows discounts, delivery fees and your final total."
              }
              requirement={cartSettlesTheBill ? "optional" : "recommended"}
              emphasize={emphasizeCheckout}
              art="receipt"
              example="checkout"
              allowRemove
              file={checkoutFile}
              onChange={(file, original) => {
                setCheckoutPicked(false);
                onCheckoutChange(file, original);
              }}
              onFilePicked={(file) => {
                setUploadStarted(true);
                setCheckoutPicked(true);
                track("checkout_uploaded");
                onCheckoutPicked(file);
              }}
            />
          </div>

          <div className="relative py-0.5">
            <span aria-hidden="true" className="absolute inset-x-0 top-1/2 h-px bg-ink-200" />
            <span className="relative mx-auto block w-12 bg-canvas text-center text-[0.78rem] font-bold uppercase tracking-wide text-slate-500">
              or
            </span>
          </div>

          <div className="rounded-3xl bg-cream p-3.5 ring-1 ring-sand">
            <h3 className="text-[1rem] font-extrabold text-ink-900">
              {canCalculate ? "Don't have a checkout screenshot?" : askingForOne ? "Don't have a checkout screenshot?" : fieldLabel}
            </h3>
            <p className="mt-0.5 mb-3 text-[0.88rem] leading-snug text-slate-600">
              {breakdownMode
                ? "Enter your order breakdown. Enter 0 for fees or discounts that don't apply."
                : cartSettlesTheBill
                ? "This is what we read off your cart screenshot — after discounts, fees and delivery."
                : settledFill
                  ? "This is what we read off your screenshots — after discounts, fees and delivery."
                  : subtotalOnly
                    ? "We read this off your cart screenshot. It's the food only — the screen didn't show delivery or service fees."
                    : checkoutFile
                      ? "We couldn't read a total off your screenshots — type the final payable amount here."
                      : "Enter your final payable amount instead — after discounts, fees and delivery."}
            </p>
            {breakdownMode ? (
              <>
                <div className="grid grid-cols-2 gap-x-3 gap-y-4">
                  {(Object.keys(breakdownLabels) as (keyof Breakdown)[]).map((key) => (
                    <AmountInput
                      key={key}
                      scale="sm"
                      label={breakdownLabels[key]}
                      value={parts[key]}
                      placeholder={key === "subtotal" ? "58.00" : "0.00"}
                      onChange={(event) => changePart(key, event.target.value)}
                      error={showBreakdownErrors ? calculation.errors[key] : undefined}
                    />
                  ))}
                </div>
                <div className="mt-4 rounded-2xl bg-brand-100 p-3">
                  <AmountInput label="Final total (AED)" value={calculation.total} readOnly placeholder="—" error={showBreakdownErrors ? calculation.totalError : undefined} />
                  <p className="mt-2 text-xs text-slate-600">Subtotal + delivery + service fee − discount</p>
                </div>
              </>
            ) : <AmountInput
              label={fieldLabel}
              hideLabel={!askingForOne}
              value={manualTotal}
              onChange={(event) => onManualTotalChange(event.target.value)}
              error={totalError}
            />}
            {canCalculate ? (
              <button type="button" className="mt-2 min-h-11 text-sm font-bold text-ink-800 underline underline-offset-4" onClick={() => {
                setShowBreakdownErrors(false);
                onManualStateChange({ ...manualState, mode: breakdownMode ? "direct" : "breakdown" });
                onManualTotalChange(breakdownMode ? calculation.total : calculateManualTotal(parts).total);
              }}>
                {breakdownMode ? "I already know my final total" : "Calculate from subtotal and fees"}
              </button>
            ) : null}
            <p className="mt-3 text-[0.82rem] leading-snug text-slate-500">
              {breakdownMode
                ? "Enter the discount as an AED amount. Your final total updates automatically."
                : cartSettlesTheBill || settledFill
                ? "Change it only if it looks wrong."
                : subtotalOnly
                  ? "Add the checkout screenshot above and we'll read your real total — or type it here yourself."
                  : checkoutFile
                    ? "You can change this on the next screen."
                    : "A checkout screenshot gives the most accurate comparison, but either one works. You can change this on the next screen."}
            </p>
          </div>
        </div>
      )}

      {/* Returning customers can still reopen an earlier order, after the
          upload action rather than ahead of the first screen's main task. */}
      {uploadStarted || returnedFromApp ? null : <LastOrderBanner />}

      <div className={!cartFile ? "[&>div]:static" : undefined}>
        <StepActions>
          <Button onClick={() => {
            if (breakdownMode && manualState.parts !== null && !calculation.total) {
              setShowBreakdownErrors(true);
              return;
            }
            onContinue();
          }} disabled={!cartFile} arrow>
            Continue
          </Button>
          {!cartFile ? (
            <p className="mt-2.5 text-center text-sm text-slate-500">
              Add your cart screenshot to continue.
            </p>
          ) : null}
        </StepActions>
      </div>

      {/* The way back to an order this browser did not send - a different
          phone, or one that cleared its storage. It used to sit above the
          headline, where it was a third path competing for the attention of
          somebody who did not yet know what this page was; LastOrderBanner
          still takes the top slot when there IS an order to resume, which is
          the one case worth interrupting for. */}
      <p className="mt-4 text-center text-[0.85rem] text-slate-500">
        Sent us an order already?{" "}
        <Link
          href="/find"
          className="inline-flex min-h-11 items-center px-1.5 font-bold text-ink-800 underline underline-offset-2"
        >
          Find it with your reference
        </Link>
      </p>
    </>
  );
}
