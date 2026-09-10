"use client";

import { Button } from "@/components/ui/Button";
import { ImageUpload } from "@/components/forms/ImageUpload";
import { FoodStrip } from "@/components/customer/FoodArt";

interface StepUploadProps {
  cartFile: File | null;
  checkoutFile: File | null;
  onCartChange: (file: File | null) => void;
  onCheckoutChange: (file: File | null) => void;
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
  return (
    <>
      <FoodStrip className="mb-5 h-24" />

      <h1 className="text-[1.75rem] font-extrabold leading-tight text-ink-900">
        Upload your order
      </h1>
      <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-500">
        Upload your cart screenshot. Adding the checkout screen helps us compare the final price
        more accurately.
      </p>

      <div className="mt-5 space-y-3">
        <ImageUpload
          step={1}
          label="Order details"
          hint="Restaurant and selected items"
          accent="required"
          emptyArt="burger"
          file={cartFile}
          onChange={onCartChange}
          error={error}
        />

        <ImageUpload
          step={2}
          label="Final checkout total"
          hint="Helps us include fees, discounts and delivery charges."
          optional
          allowRemove
          emptyArt="fries"
          file={checkoutFile}
          onChange={onCheckoutChange}
        />
      </div>

      <div className="mt-auto pt-7">
        <Button onClick={onContinue} disabled={!cartFile}>
          Continue
        </Button>
        {!cartFile ? (
          <p className="mt-2.5 text-center text-xs text-ink-400">
            Add your cart screenshot to continue.
          </p>
        ) : null}
      </div>
    </>
  );
}
