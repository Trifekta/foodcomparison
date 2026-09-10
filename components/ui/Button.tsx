import type { ButtonHTMLAttributes, ReactNode } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type Variant = "primary" | "dark" | "secondary" | "ghost" | "danger";
type Size = "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  /** Text shown while `loading` is true, e.g. "Sending…". */
  loadingLabel?: string;
  /** Trailing arrow, as on every primary call to action in the designs. */
  arrow?: boolean;
  children: ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand-400 text-ink-900 hover:bg-brand-300 active:bg-brand-500 shadow-sm",
  dark: "bg-ink-900 text-white hover:bg-ink-800 active:bg-black",
  secondary: "bg-white text-ink-800 ring-1 ring-ink-200 hover:bg-ink-50",
  ghost: "bg-transparent text-slate-600 hover:bg-ink-100",
  danger: "bg-rose-600 text-white hover:bg-rose-700",
};

const SIZES: Record<Size, string> = {
  // Comfortable thumb targets on a 360px phone.
  md: "min-h-11 px-5 text-sm",
  lg: "min-h-14 px-6 text-base",
};

export function Button({
  variant = "primary",
  size = "lg",
  loading = false,
  loadingLabel,
  arrow = false,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  const inactive = disabled || loading;

  return (
    <button
      type={type}
      disabled={inactive}
      aria-busy={loading || undefined}
      className={cn(
        "relative inline-flex w-full items-center justify-center rounded-full font-bold transition-colors",
        SIZES[size],
        // A disabled primary reads as a flat grey pill, as in the designs,
        // rather than a faded yellow one.
        disabled && !loading
          ? "cursor-not-allowed bg-ink-200 text-ink-400 shadow-none"
          : VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      {loading ? (
        <span className="inline-flex items-center gap-2">
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          {loadingLabel ?? "Working…"}
        </span>
      ) : (
        <>
          <span className="inline-flex items-center gap-2">{children}</span>
          {arrow ? (
            <ArrowRight aria-hidden="true" className="absolute right-6 h-5 w-5" />
          ) : null}
        </>
      )}
    </button>
  );
}
