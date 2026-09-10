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

/** Selectable chips backed by real radio inputs, sized for thumbs. */
export function RadioCardGroup({
  legend,
  options,
  value,
  onChange,
  error,
  columns = 2,
}: RadioCardGroupProps) {
  const name = useId();
  const errorId = `${name}-error`;

  return (
    <fieldset aria-describedby={error ? errorId : undefined} aria-invalid={error ? true : undefined}>
      <legend className="mb-2 text-[0.95rem] font-bold text-ink-900">{legend}</legend>
      <div className={cn("grid gap-2", columns === 2 ? "grid-cols-2" : "grid-cols-1")}>
        {options.map((option) => {
          const checked = option.value === value;
          return (
            <label
              key={option.value}
              className={cn(
                "flex min-h-13 cursor-pointer items-center justify-between gap-2 rounded-2xl border px-4 py-3 transition-colors",
                checked
                  ? "border-ink-900 bg-ink-900 text-white"
                  : "border-ink-200 bg-white text-ink-800 hover:border-ink-300",
              )}
            >
              <span>
                <span className="block text-[0.95rem] font-bold">{option.label}</span>
                {option.description ? (
                  <span
                    className={cn(
                      "mt-0.5 block text-xs",
                      checked ? "text-white/70" : "text-ink-500",
                    )}
                  >
                    {option.description}
                  </span>
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
              {checked ? (
                <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-brand-400" />
              ) : null}
            </label>
          );
        })}
      </div>
      <FieldError id={errorId} message={error} />
    </fieldset>
  );
}
