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
      <h1 className="text-2xl font-extrabold tracking-tight text-ink-900">
        Where are you ordering?
      </h1>
      <p className="mt-2 text-base text-ink-600">We&apos;re live in Dubai right now.</p>

      <div className="mt-6 space-y-6">
        <AreaCombobox
          label="Your Dubai area"
          areas={areas}
          value={areaId}
          onChange={onAreaChange}
          error={errors.areaId}
        />

        <RadioCardGroup
          legend="Which app are you ordering from?"
          options={SOURCE_APPS.map((app) => ({ value: app, label: app }))}
          value={sourceApp}
          onChange={onSourceAppChange}
          error={errors.sourceApp}
        />

        {sourceApp === OTHER_APP_VALUE ? (
          <div>
            <label htmlFor={otherId} className="mb-2 block text-sm font-semibold text-ink-900">
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
              className="min-h-13 w-full rounded-xl border border-ink-200 bg-white px-4 text-base text-ink-900 placeholder:text-ink-400"
              placeholder="Which app?"
            />
            <FieldError id={`${otherId}-error`} message={errors.sourceAppOther} />
          </div>
        ) : null}
      </div>

      <div className="mt-auto pt-8">
        <Button onClick={onContinue}>Continue</Button>
      </div>
    </>
  );
}
