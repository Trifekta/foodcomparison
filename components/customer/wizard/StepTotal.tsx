"use client";

import { Button } from "@/components/ui/Button";
import { AmountInput } from "@/components/forms/AmountInput";
import { ImageUpload } from "@/components/forms/ImageUpload";

interface StepTotalProps {
  currentTotal: string;
  onCurrentTotalChange: (value: string) => void;
  totalError?: string;
  checkoutFile: File | null;
  onCheckoutFileChange: (file: File | null) => void;
  onContinue: () => void;
}

export function StepTotal({
  currentTotal,
  onCurrentTotalChange,
  totalError,
  checkoutFile,
  onCheckoutFileChange,
  onContinue,
}: StepTotalProps) {
  return (
    <>
      <h1 className="text-2xl font-extrabold tracking-tight text-ink-900">
        What&apos;s your final total?
      </h1>
      <p className="mt-2 text-base text-ink-600">
        Open the checkout screen in your delivery app and enter the amount you would actually pay.
      </p>

      <div className="mt-6">
        <AmountInput
          label="Final checkout total"
          value={currentTotal}
          onChange={(event) => onCurrentTotalChange(event.target.value)}
          error={totalError}
        />
      </div>

      {/*
        The checkout screenshot is deliberately secondary: a quiet, clearly
        optional card below the required amount. It must never read as a
        second mandatory upload.
      */}
      <section className="mt-8 rounded-2xl border border-ink-200 bg-white/60 p-4">
        <h2 className="text-sm font-semibold text-ink-900">Want a more accurate comparison?</h2>
        <div className="mt-3">
          <ImageUpload
            label="Upload your checkout screenshot"
            optional
            allowRemove
            hint="This can help us account for delivery fees, discounts, membership benefits and vouchers."
            file={checkoutFile}
            onChange={onCheckoutFileChange}
          />
        </div>
      </section>

      <div className="mt-auto pt-8">
        <Button onClick={onContinue}>Continue</Button>
      </div>
    </>
  );
}
