"use client";

import { Info } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { AmountInput } from "@/components/forms/AmountInput";

interface StepTotalProps {
  currentTotal: string;
  onCurrentTotalChange: (value: string) => void;
  totalError?: string;
  hasCheckoutScreenshot: boolean;
  onContinue: () => void;
}

export function StepTotal({
  currentTotal,
  onCurrentTotalChange,
  totalError,
  hasCheckoutScreenshot,
  onContinue,
}: StepTotalProps) {
  return (
    <>
      <h1 className="text-[1.75rem] font-extrabold leading-tight text-ink-900">
        What&apos;s your final total?
      </h1>
      <p className="mt-1.5 text-[0.95rem] text-ink-500">
        Open the checkout screen in your delivery app and enter the amount you would actually pay.
      </p>

      <div className="mt-6">
        <AmountInput
          label="Total paid price"
          scale="lg"
          value={currentTotal}
          onChange={(event) => onCurrentTotalChange(event.target.value)}
          error={totalError}
        />
      </div>

      <p className="mt-4 flex items-start gap-2 rounded-2xl bg-ink-50 p-3.5 text-sm leading-relaxed text-ink-500">
        <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
        <span>
          {hasCheckoutScreenshot
            ? "We'll cross-check this against the checkout screenshot you added."
            : "Include delivery fees and any discounts — this is the number we compare against."}
        </span>
      </p>

      <div className="mt-auto pt-7">
        <Button onClick={onContinue}>Continue</Button>
      </div>
    </>
  );
}
