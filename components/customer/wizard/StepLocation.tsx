"use client";

import { useId } from "react";
import type { PublicArea } from "@/types/database";
import { OTHER_APP_VALUE, SOURCE_APPS } from "@/lib/constants";
import { Button } from "@/components/ui/Button";
import { AreaCombobox } from "@/components/forms/AreaCombobox";
import { RadioCardGroup } from "@/components/forms/RadioCardGroup";
import { FieldError } from "@/components/ui/FieldError";

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
      <h1 className="text-[1.75rem] font-extrabold leading-tight text-ink-900">
        Where are you ordering?
      </h1>
      <p className="mt-2 text-[0.95rem] leading-relaxed text-ink-500">
        The same food can cost more or less depending on where it is delivered.
      </p>

      <div className="mt-5 space-y-5">
        <div className="rounded-3xl bg-cream p-4 ring-1 ring-sand">
          <AreaCombobox
            label="Delivery area in Dubai"
            areas={areas}
            value={areaId}
            onChange={onAreaChange}
            error={errors.areaId}
          />
        </div>

        <RadioCardGroup
          legend="Which app are you ordering from?"
          options={SOURCE_APPS.map((app) => ({ value: app, label: app }))}
          value={sourceApp}
          onChange={onSourceAppChange}
          error={errors.sourceApp}
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
              className="min-h-14 w-full rounded-2xl border border-ink-200 bg-white px-4 text-base font-semibold text-ink-900 placeholder:font-normal placeholder:text-ink-400"
              placeholder="Which app?"
            />
            <FieldError id={`${otherId}-error`} message={errors.sourceAppOther} />
          </div>
        ) : null}
      </div>

      <div className="mt-auto pt-7">
        <Button onClick={onContinue}>Continue</Button>
      </div>
    </>
  );
}
