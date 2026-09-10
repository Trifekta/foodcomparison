"use client";

import { Button } from "@/components/ui/Button";
import { ImageUpload } from "@/components/forms/ImageUpload";

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
 * The cart screenshot is required. The checkout one is genuinely optional and
 * is labelled as such - it buys a more accurate comparison, and nothing is
 * blocked without it.
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
      <h1 className="text-[1.75rem] font-extrabold leading-tight text-ink-900">
        Upload your order
      </h1>
      <p className="mt-1.5 text-[0.95rem] text-ink-500">
        One screenshot from your delivery app is all we need.
      </p>

      <div className="mt-5 space-y-3">
        <ImageUpload
          step={1}
          label="Order details"
          hint="Restaurant and selected items"
          file={cartFile}
          onChange={onCartChange}
          error={error}
        />

        <ImageUpload
          step={2}
          label="Final checkout total"
          hint="Fees and total price — helps us match discounts and delivery fees"
          optional
          allowRemove
          file={checkoutFile}
          onChange={onCheckoutChange}
        />
      </div>

      <p className="mt-4 text-sm leading-relaxed text-ink-400">
        Make sure the restaurant, items and quantities are visible.
      </p>

      <div className="mt-auto pt-7">
        <Button onClick={onContinue} disabled={!cartFile}>
          Check my order
        </Button>
      </div>
    </>
  );
}
