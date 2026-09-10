"use client";

import { Info, MapPin, ScanLine } from "lucide-react";
import type { PublicArea } from "@/types/database";
import { CURRENCY } from "@/lib/constants";
import { Button } from "@/components/ui/Button";
import { AmountInput } from "@/components/forms/AmountInput";
import { AreaCombobox } from "@/components/forms/AreaCombobox";
import { FoodPhoto } from "@/components/customer/FoodPhoto";
import { ScriptBubble } from "@/components/customer/Motifs";

interface StepWhereAndTotalProps {
  areas: PublicArea[];
  areaId: string;
  currentTotal: string;
  errors: { areaId?: string; currentTotal?: string };
  hasCheckoutScreenshot: boolean;
  /** The total read off the screenshots, if one was found. */
  readTotal: string | null;
  /** Whether that total came off the checkout screen rather than the cart. */
  totalFromCheckout: boolean;
  onAreaChange: (areaId: string) => void;
  onCurrentTotalChange: (value: string) => void;
  onUseReadTotal: () => void;
  onContinue: () => void;
}

/**
 * Where it goes, and what it costs.
 *
 * These two were separate screens, and neither had enough on it to earn one.
 * They belong together: the area decides the delivery fee and whether the
 * restaurant is available at all, so it is half of what the total is made of.
 *
 * The area comes first because it is the required lookup - putting it under a
 * variable-length field is how a customer gets stopped by a question they
 * never saw.
 */
export function StepWhereAndTotal({
  areas,
  areaId,
  currentTotal,
  errors,
  hasCheckoutScreenshot,
  readTotal,
  totalFromCheckout,
  onAreaChange,
  onCurrentTotalChange,
  onUseReadTotal,
  onContinue,
}: StepWhereAndTotalProps) {
  // Offered, never filled in for them. This number is the baseline for the
  // saving we quote back, and the read is rough - so it takes a deliberate tap.
  const showHint = readTotal !== null && readTotal !== "" && readTotal !== currentTotal;

  return (
    <>
      {/* Heading with the food-and-pin vignette to its right */}
      <div className="relative">
        <div className="relative z-10 max-w-[58%]">
          <h1 className="text-[1.85rem] font-extrabold leading-tight text-ink-900">
            Where and how much?
          </h1>
          <p className="mt-1.5 text-[0.95rem] leading-relaxed text-slate-600">
            The same food costs more or less depending on where it is delivered.
          </p>
          <span aria-hidden="true" className="mt-1.5 block h-[3px] w-16 rounded-full bg-brand-400" />
        </div>

        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-2 -right-2 h-36 w-[42%] select-none"
        >
          <span className="absolute inset-x-0 top-2 bottom-5 rounded-[2.5rem] bg-linear-to-br from-brand-100/80 to-beige" />
          <FoodPhoto name="bowl" eager className="absolute bottom-2 right-3 w-[70%]" />
          <MapPin className="absolute right-[40%] top-1 h-8 w-8 fill-[#e2483a] text-[#e2483a] drop-shadow" />
          <ScriptBubble className="absolute right-0 top-0 text-[0.66rem]">
            Good
            <br />
            Food Nearby
          </ScriptBubble>
        </div>
      </div>

      <div className="mt-4 space-y-5">
        {/* Delivery area - the lookup, first */}
        <div className="rounded-3xl bg-linear-to-b from-brand-100 to-beige p-3.5">
          <div className="mb-2.5 flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-300"
            >
              <MapPin className="h-4.5 w-4.5 text-ink-900" />
            </span>
            <span className="text-[1.02rem] font-extrabold text-ink-900">Delivery area in Dubai</span>
          </div>
          <AreaCombobox
            label="Delivery area in Dubai"
            hideLabel
            areas={areas}
            value={areaId}
            onChange={onAreaChange}
            error={errors.areaId}
          />
        </div>

        {/* Final total */}
        <div>
          <div className="rounded-3xl bg-linear-to-b from-brand-100 to-beige p-3.5">
            <AmountInput
              label="Total paid price"
              scale="lg"
              value={currentTotal}
              onChange={(event) => onCurrentTotalChange(event.target.value)}
              error={errors.currentTotal}
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

          <p className="mt-3 flex items-start gap-2 rounded-2xl bg-flame-50 p-3.5 text-sm leading-relaxed text-ink-600">
            <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-flame-500" />
            <span>
              {hasCheckoutScreenshot
                ? "We'll cross-check this against the checkout screenshot you added."
                : "Include delivery fees and any discounts — this is the number we compare against."}
            </span>
          </p>
        </div>
      </div>

      <div className="mt-5">
        <Button onClick={onContinue} arrow>
          Continue
        </Button>
      </div>
    </>
  );
}
