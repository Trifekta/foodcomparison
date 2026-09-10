"use client";

import { useId } from "react";
import { MapPin } from "lucide-react";
import type { PublicArea } from "@/types/database";
import { OTHER_APP_VALUE, SOURCE_APPS } from "@/lib/constants";
import { Button } from "@/components/ui/Button";
import { AreaCombobox } from "@/components/forms/AreaCombobox";
import { RadioCardGroup } from "@/components/forms/RadioCardGroup";
import { FieldError } from "@/components/ui/FieldError";
import { Burger, GrainBowl } from "@/components/customer/FoodArt";
import { ScriptBubble, ScriptNote } from "@/components/customer/Motifs";

interface StepLocationProps {
  areas: PublicArea[];
  areaId: string;
  sourceApp: string;
  sourceAppOther: string;
  errors: { areaId?: string; sourceApp?: string; sourceAppOther?: string };
  onAreaChange: (areaId: string) => void;
  onSourceAppChange: (app: string) => void;
  onSourceAppOtherChange: (name: string) => void;
  onContinue: () => void;
}

/**
 * Delivery area and source app.
 *
 * Tints distinguish the app options at a glance. They are category colours on
 * plain text labels - no third-party logo or wordmark is reproduced.
 */
const APP_TINTS: Record<string, string> = {
  Talabat: "bg-chip-red-bg text-chip-red-fg",
  "Careem Food": "bg-chip-green-bg text-chip-green-fg",
  Deliveroo: "bg-chip-teal-bg text-chip-teal-fg",
  "Noon Food": "bg-chip-amber-bg text-chip-amber-fg",
  Other: "bg-chip-grey-bg text-chip-grey-fg",
};

export function StepLocation({
  areas,
  areaId,
  sourceApp,
  sourceAppOther,
  errors,
  onAreaChange,
  onSourceAppChange,
  onSourceAppOtherChange,
  onContinue,
}: StepLocationProps) {
  const otherId = useId();

  return (
    <>
      {/* Heading with the food-and-pin vignette to its right */}
      <div className="relative">
        <div className="relative z-10 max-w-[60%]">
          <h1 className="text-[1.85rem] font-extrabold leading-tight text-ink-900">
            Where are you ordering?
          </h1>
          <p className="mt-1.5 text-[0.95rem] leading-relaxed text-slate-600">
            The same food can cost more or less depending on where it is delivered.
          </p>
          <span aria-hidden="true" className="mt-1.5 block h-[3px] w-16 rounded-full bg-brand-400" />
        </div>

        <div aria-hidden="true" className="pointer-events-none absolute -top-2 right-0 h-32 w-[42%] select-none">
          <GrainBowl className="absolute bottom-1 right-0 h-[62%] w-auto drop-shadow-sm" />
          <MapPin className="absolute bottom-[38%] right-[26%] h-9 w-9 fill-[#e2483a] text-[#e2483a] drop-shadow-sm" />
          <ScriptBubble className="absolute -top-1 right-0 text-[0.68rem]">
            Good
            <br />
            Food Nearby
          </ScriptBubble>
        </div>
      </div>

      <div className="mt-4 space-y-5">
        {/* Delivery area card */}
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

        <RadioCardGroup
          legend="Which app are you ordering from?"
          help="Select the app you'll be using to place your order."
          options={SOURCE_APPS.map((app) => ({ value: app, label: app }))}
          value={sourceApp}
          onChange={onSourceAppChange}
          error={errors.sourceApp}
          tints={APP_TINTS}
        />

        {sourceApp === OTHER_APP_VALUE ? (
          <div>
            <label htmlFor={otherId} className="mb-2 block text-[0.95rem] font-bold text-ink-900">
              App name
            </label>
            <input
              id={otherId}
              type="text"
              autoComplete="off"
              value={sourceAppOther}
              onChange={(event) => onSourceAppOtherChange(event.target.value)}
              aria-describedby={errors.sourceAppOther ? `${otherId}-error` : undefined}
              aria-invalid={errors.sourceAppOther ? true : undefined}
              className="min-h-14 w-full rounded-2xl bg-white px-4 text-base font-semibold text-ink-900 ring-1 ring-ink-200 placeholder:font-normal placeholder:text-slate-400"
              placeholder="Which app?"
            />
            <FieldError id={`${otherId}-error`} message={errors.sourceAppOther} />
          </div>
        ) : null}

        {/* Reassurance strip */}
        <div className="relative overflow-hidden rounded-3xl bg-linear-to-r from-beige to-brand-100 px-4 py-3.5">
          <div className="relative z-10 flex items-center gap-3 pr-20">
            <ScriptNote underline className="shrink-0 text-[1rem] text-ink-900">
              Same Food
              <br />
              Lower Prices
            </ScriptNote>
            <p className="text-[0.8rem] leading-snug text-slate-600">
              Compare across apps and keep more for what really matters.
            </p>
          </div>
          <Burger
            className="pointer-events-none absolute -bottom-2 right-1 h-16 w-auto select-none drop-shadow-sm"
          />
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
