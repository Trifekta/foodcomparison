"use client";

import { Info, ScanLine } from "lucide-react";
import { CURRENCY } from "@/lib/constants";
import { Button } from "@/components/ui/Button";
import { AmountInput } from "@/components/forms/AmountInput";

interface StepTotalProps {
  currentTotal: string;
  onCurrentTotalChange: (value: string) => void;
  totalError?: string;
  hasCheckoutScreenshot: boolean;
  /** The total read off the screenshots, if one was found. */
  readTotal: string | null;
  /** Whether that total came off the checkout screen rather than the cart. */
  totalFromCheckout: boolean;
  onUseReadTotal: () => void;
  onContinue: () => void;
}

export function StepTotal({
  currentTotal,
  onCurrentTotalChange,
  totalError,
  hasCheckoutScreenshot,
  readTotal,
  totalFromCheckout,
  onUseReadTotal,
  onContinue,
}: StepTotalProps) {
  // Offered, never filled in for them. This number is the baseline for the
  // saving we quote back, and the read is rough - so it takes a deliberate tap.
  const showHint = readTotal !== null && readTotal !== "" && readTotal !== currentTotal;
  return (
    <>
      <h1 className="text-[1.9rem] font-extrabold leading-tight text-ink-900">
        What&apos;s your final total?
      </h1>
      <p className="mt-1.5 text-[0.95rem] leading-relaxed text-slate-600">
        Open the checkout screen in your delivery app and enter the amount you would actually pay.
      </p>

      <div className="mt-5 rounded-3xl bg-linear-to-b from-brand-100 to-beige p-3.5">
        <AmountInput
          label="Total paid price"
          scale="lg"
          value={currentTotal}
          onChange={(event) => onCurrentTotalChange(event.target.value)}
          error={totalError}
        />
      </div>

      {showHint ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-chip-green-bg px-3.5 py-3">
          <p className="flex min-w-0 flex-1 items-start gap-2 text-sm leading-snug text-chip-green-fg">
            <ScanLine aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Your {totalFromCheckout ? "checkout screenshot" : "screenshot"} looked like{" "}
              <span className="font-extrabold tabular-nums">
                {CURRENCY} {readTotal}
              </span>
              .
            </span>
          </p>
          <button
            type="button"
            onClick={onUseReadTotal}
            className="min-h-9 shrink-0 rounded-full bg-white px-3.5 text-sm font-bold text-ink-900 ring-1 ring-emerald-200 hover:bg-emerald-50"
          >
            Use this
          </button>
        </div>
      ) : null}

      <p className="mt-4 flex items-start gap-2 rounded-2xl bg-flame-50 p-3.5 text-sm leading-relaxed text-ink-600">
        <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-flame-500" />
        <span>
          {hasCheckoutScreenshot
            ? "We'll cross-check this against the checkout screenshot you added."
            : "Include delivery fees and any discounts — this is the number we compare against."}
        </span>
      </p>

      <div className="mt-5">
        <Button onClick={onContinue} arrow>
          Continue
        </Button>
      </div>
    </>
  );
}
