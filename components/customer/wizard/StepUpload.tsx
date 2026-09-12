"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { ImageUpload } from "@/components/forms/ImageUpload";
import { FoodPhoto } from "@/components/customer/FoodPhoto";
import { ScriptBubble, ScriptNote, Sparks } from "@/components/customer/Motifs";
import { LastOrderBanner } from "@/components/customer/LastOrderBanner";
import { track } from "@/lib/analytics/track";
import { RESULT_PROMISE } from "@/lib/constants";

interface StepUploadProps {
  cartFile: File | null;
  checkoutFile: File | null;
  /** `original` is the untouched file, before it was compressed for upload. */
  onCartChange: (file: File | null, original?: File | null) => void;
  onCheckoutChange: (file: File | null, original?: File | null) => void;
  error: string | null;
  onContinue: () => void;
}

/**
 * Both screenshots in one place.
 *
 * The cart screenshot is required. The checkout one is genuinely optional: it
 * is labelled as such, never raises an error when missing, and does not gate
 * the Continue button.
 */
export function StepUpload({
  cartFile,
  checkoutFile,
  onCartChange,
  onCheckoutChange,
  error,
  onContinue,
}: StepUploadProps) {
  // Start fetching the reading engine now, while they are in their gallery
  // choosing a photo. Waiting until they have chosen puts several megabytes
  // directly in front of the screen meant to impress them.
  useEffect(() => {
    let cancelled = false;
    void import("@/lib/ocr/browser").then(({ warmOcr }) => {
      if (!cancelled) warmOcr("customer");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // The top of the funnel. Recorded once when this screen first appears, which
  // is the only moment that means "somebody arrived".
  useEffect(() => {
    track("wizard_started");
  }, []);

  return (
    <>
      {/* Hero banner. The spread bleeds past the top edge, as in the reference. */}
      <div className="relative rounded-3xl bg-linear-to-r from-brand-100 to-beige px-4 py-4">
        <div className="relative z-10 max-w-[44%]">
          <ScriptNote underline className="text-[1.35rem] text-ink-900">
            Same Food
            <br />
            Lower Prices
          </ScriptNote>
          <p className="mt-2 text-[0.82rem] font-semibold leading-snug text-slate-600">
            Upload. Compare.
            <br />
            Save more.
          </p>
        </div>
        <FoodPhoto
          name="spread"
          eager
          className="pointer-events-none absolute right-0 top-1/2 w-[62%] -translate-y-1/2 select-none"
        />
        <ScriptBubble className="absolute -right-1 -top-2 z-10 text-[0.64rem] leading-tight">
          Good
          <br />
          Deals Ahead <span aria-hidden="true">&hearts;</span>
        </ScriptBubble>
      </div>

      {/* Above everything, because somebody who already has an order in flight
          is not here to start another one. */}
      <LastOrderBanner />

      <h1 className="relative mt-4 inline-flex items-start text-[1.9rem] font-extrabold leading-tight text-ink-900">
        Upload your order
        <Sparks className="ml-1 h-5 w-5 shrink-0" />
      </h1>
      <p className="mt-1.5 text-[0.95rem] leading-relaxed text-slate-600">
        Upload your cart screenshot. Adding the checkout screen helps us compare the final price
        more accurately.
      </p>

      {/* Repeated from the landing page on purpose. This is the screen where
          somebody weighs the wait against the effort of finding a screenshot,
          and the answer to "how long will this take" belongs next to that
          decision, not one screen behind it. */}
      <p className="mt-2.5 inline-block rounded-full bg-brand-100 px-3.5 py-1.5 text-[0.85rem] font-bold text-ink-800">
        Your result, usually {RESULT_PROMISE}
      </p>

      <div className="mt-4 space-y-3">
        <ImageUpload
          step={1}
          label="Order details"
          hint="Restaurant and selected items"
          helper="Make sure your restaurant name and ordered items are visible."
          requirement="required"
          art="cartDoc"
          file={cartFile}
          onChange={onCartChange}
          error={error}
        />

        <ImageUpload
          step={2}
          label="Final checkout total"
          hint="Fees, discounts and final total"
          helper="Include the total and fees if visible."
          requirement="optional"
          art="receipt"
          allowRemove
          file={checkoutFile}
          onChange={onCheckoutChange}
        />
      </div>

      <div className="mt-5">
        <Button onClick={onContinue} disabled={!cartFile} arrow>
          Continue
        </Button>
        {!cartFile ? (
          <p className="mt-2.5 text-center text-sm text-slate-500">
            Add your cart screenshot to continue.
          </p>
        ) : null}
      </div>
    </>
  );
}
