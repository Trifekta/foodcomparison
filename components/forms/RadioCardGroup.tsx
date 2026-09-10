"use client";

import { useId } from "react";
import { Check } from "lucide-react";
import { FieldError } from "@/components/ui/FieldError";
import { cn } from "@/lib/utils/cn";

export interface RadioCardOption {
  value: string;
  label: string;
  description?: string;
}

interface RadioCardGroupProps {
  legend: string;
  options: RadioCardOption[];
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  columns?: 1 | 2;
}

/** Thumb-sized radio group rendered as cards, using real radio inputs. */
export function RadioCardGroup({
  legend,
  options,
  value,
  onChange,
  error,
  columns = 1,
}: RadioCardGroupProps) {
  const name = useId();
  const errorId = `${name}-error`;

  return (
    <fieldset aria-describedby={error ? errorId : undefined} aria-invalid={error ? true : undefined}>
      <legend className="mb-2 text-sm font-semibold text-ink-900">{legend}</legend>
      <div className={cn("grid gap-2", columns === 2 ? "grid-cols-2" : "grid-cols-1")}>
        {options.map((option) => {
          const checked = option.value === value;
          return (
            <label
              key={option.value}
              className={cn(
                "flex min-h-13 cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-colors",
                checked
                  ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500"
                  : "border-ink-200 bg-white hover:border-ink-300",
              )}
            >
              <span>
                <span className="block text-base font-medium text-ink-900">{option.label}</span>
                {option.description ? (
                  <span className="mt-0.5 block text-xs text-ink-500">{option.description}</span>
                ) : null}
              </span>
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
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                  checked ? "border-brand-600 bg-brand-500" : "border-ink-300 bg-white",
                )}
              >
                {checked ? <Check className="h-3 w-3 text-ink-900" /> : null}
              </span>
            </label>
          );
        })}
      </div>
      <FieldError id={errorId} message={error} />
    </fieldset>
  );
}
