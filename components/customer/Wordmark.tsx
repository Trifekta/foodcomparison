import { WORDMARK_PRIMARY, WORDMARK_ACCENT, BRAND_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils/cn";

/**
 * The SnipSavor lockup: "Snip" in near-black, "Savor" under a golden rule.
 *
 * Rendered as text so it stays crisp and readable to assistive technology; the
 * accessible name is the full brand name, and the two halves are hidden from it
 * so the name is not read out twice.
 *
 * The halves come from constants rather than from slicing the brand name, so
 * renaming the product does not mean editing this component.
 */
export function Wordmark({
  size = "md",
  className,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const scale = {
    sm: { text: "text-base", rule: "h-[3px]" },
    md: { text: "text-xl", rule: "h-[3px]" },
    lg: { text: "text-2xl", rule: "h-1" },
  }[size];

  return (
    <span
      aria-label={BRAND_NAME}
      className={cn("inline-flex items-baseline font-extrabold tracking-tight", className)}
    >
      <span aria-hidden="true" className={cn(scale.text, "text-ink-900")}>
        {WORDMARK_PRIMARY}
        <span className="relative inline-block">
          {WORDMARK_ACCENT}
          <span
            className={cn(
              "absolute inset-x-0 -bottom-0.5 rounded-full bg-brand-400",
              scale.rule,
            )}
          />
        </span>
      </span>
    </span>
  );
}
