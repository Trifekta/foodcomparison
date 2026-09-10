"use client";

import { useId } from "react";
import { FieldError } from "@/components/ui/FieldError";
import { Sparks } from "@/components/customer/Motifs";
import { cn } from "@/lib/utils/cn";

export interface RadioCardOption {
  value: string;
  label: string;
  description?: string;
}

interface RadioCardGroupProps {
  legend: string;
  /** Optional line under the legend. */
  help?: string;
  options: RadioCardOption[];
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  columns?: 1 | 2 | 3;
  /** Per-option tint. Categories, not brand marks - no logo is reproduced. */
  tints?: Record<string, string>;
}

const BASE_TINT = "bg-chip-grey-bg text-chip-grey-fg";

export function RadioCardGroup({
  legend,
  help,
  options,
  value,
  onChange,
  error,
  columns = 3,
  tints,
}: RadioCardGroupProps) {
  const name = useId();
  const errorId = `${name}-error`;

  return (
    <fieldset aria-describedby={error ? errorId : undefined} aria-invalid={error ? true : undefined}>
      <legend className="text-[1.15rem] font-extrabold text-ink-900">{legend}</legend>
      {help ? <p className="mb-3 mt-0.5 text-sm text-slate-500">{help}</p> : <div className="mb-3" />}

      <div
        className={cn(
          "grid gap-2.5",
          columns === 3 ? "grid-cols-3" : columns === 2 ? "grid-cols-2" : "grid-cols-1",
        )}
      >
        {options.map((option) => {
          const checked = option.value === value;
          return (
            <label
              key={option.value}
              className={cn(
                "relative flex min-h-[4.6rem] cursor-pointer items-center rounded-2xl px-3 py-3 transition-shadow",
                tints?.[option.value] ?? BASE_TINT,
                checked ? "ring-2 ring-ink-900" : "ring-1 ring-black/5",
              )}
            >
              <Sparks className="absolute left-2.5 top-2 h-3.5 w-3.5 opacity-70" tone="ink" />
              <span className="mt-2 text-[0.95rem] font-extrabold leading-tight">{option.label}</span>
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={checked}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              <span
                aria-hidden="true"
                className={cn(
                  "absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full border-2",
                  checked ? "border-ink-900 bg-ink-900" : "border-black/20 bg-white/70",
                )}
              >
                {checked ? <span className="h-2 w-2 rounded-full bg-white" /> : null}
              </span>
            </label>
          );
        })}
      </div>
      <FieldError id={errorId} message={error} />
    </fieldset>
  );
}
