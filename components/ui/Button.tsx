import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  /** Text shown while `loading` is true, e.g. "Uploading your cart…". */
  loadingLabel?: string;
  children: ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-brand-400 text-ink-900 hover:bg-brand-300 active:bg-brand-500 border border-brand-500/40 shadow-sm",
  secondary:
    "bg-white text-ink-800 hover:bg-ink-50 border border-ink-200",
  ghost: "bg-transparent text-ink-700 hover:bg-ink-100 border border-transparent",
  danger: "bg-rose-600 text-white hover:bg-rose-700 border border-rose-700",
};

const SIZES: Record<Size, string> = {
  // Comfortable thumb targets on a 360px phone.
  md: "min-h-11 px-4 text-sm",
  lg: "min-h-13 px-5 text-base",
};

export function Button({
  variant = "primary",
  size = "lg",
  loading = false,
  loadingLabel,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex w-full items-center justify-center gap-2 rounded-xl font-semibold transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-55",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {loading ? (
        <>
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          <span>{loadingLabel ?? "Working…"}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
