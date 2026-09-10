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
  /** "lg" renders the headline-sized field used on the customer total screen. */
  scale?: "md" | "lg";
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
}

/**
 * AED amount field. inputMode="decimal" so phones show the numeric keypad,
 * while the type stays "text" to avoid the browser's number spinners and locale
 * quirks - the value is validated as a decimal string.
 */
export const AmountInput = forwardRef<HTMLInputElement, AmountInputProps>(function AmountInput(
  { label, hint, error, placeholder = "72.50", scale = "md", ...rest },
  ref,
) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const large = scale === "lg";

  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-[0.95rem] font-bold text-ink-900">
        {label}
      </label>
      {hint ? (
        <p id={hintId} className="mb-3 text-sm text-ink-500">
          {hint}
        </p>
      ) : null}
      <div
        className={cn(
          "flex items-center rounded-2xl border bg-white",
          // The ring goes on the wrapper so it never cuts through the AED prefix.
          "focus-within:outline focus-within:outline-[3px] focus-within:outline-offset-2 focus-within:outline-ink-900",
          error ? "border-rose-400" : "border-ink-200",
        )}
      >
        <span
          className={cn(
            "shrink-0 font-bold text-ink-400",
            large ? "pl-5 pr-2.5 text-xl" : "pl-4 pr-2 text-base",
          )}
          aria-hidden="true"
        >
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
          className={cn(
            "w-full rounded-r-2xl bg-transparent font-extrabold tracking-tight text-ink-900 placeholder:font-medium placeholder:text-ink-300",
            "focus:outline-none",
            large ? "min-h-18 pr-5 text-3xl" : "min-h-14 pr-4 text-lg",
          )}
          {...rest}
        />
      </div>
      <FieldError id={errorId} message={error} />
    </div>
  );
});
