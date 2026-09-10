"use client";

import { forwardRef, useId } from "react";
import { CURRENCY } from "@/lib/constants";
import { FieldError } from "@/components/ui/FieldError";
import { cn } from "@/lib/utils/cn";

interface AmountInputProps {
  label: string;
  hint?: string;
  error?: string | null;
  placeholder?: string;
  value?: string;
  name?: string;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  autoFocus?: boolean;
}

/**
 * AED amount field. inputMode="decimal" so phones show the numeric keypad,
 * while the type stays "text" to avoid the browser's own number spinners and
 * locale quirks - the value is validated as a decimal string.
 */
export const AmountInput = forwardRef<HTMLInputElement, AmountInputProps>(function AmountInput(
  { label, hint, error, placeholder = "72.50", ...rest },
  ref,
) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-ink-900">
        {label}
      </label>
      {hint ? (
        <p id={hintId} className="mb-3 text-sm text-ink-600">
          {hint}
        </p>
      ) : null}
      <div
        className={cn(
          "flex items-center rounded-xl border bg-white",
          error ? "border-rose-400" : "border-ink-200",
        )}
      >
        <span className="pl-4 pr-2 text-base font-semibold text-ink-500" aria-hidden="true">
          {CURRENCY}
        </span>
        <input
          ref={ref}
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder={placeholder}
          aria-describedby={cn(hint ? hintId : "", error ? errorId : "").trim() || undefined}
          aria-invalid={error ? true : undefined}
          className="min-h-13 w-full rounded-r-xl bg-transparent pr-4 text-lg font-semibold text-ink-900 placeholder:font-normal placeholder:text-ink-400"
          {...rest}
        />
      </div>
      <FieldError id={errorId} message={error} />
    </div>
  );
});
