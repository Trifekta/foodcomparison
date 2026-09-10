import { WORDMARK_PRIMARY, WORDMARK_SUFFIX, BRAND_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils/cn";

/**
 * The FindFoodae lockup: "FindFood" in near-black with the "ae" set as UAE, and
 * a golden rule under "Food". Rendered as text so it stays crisp and readable
 * to assistive technology; the accessible name is the full brand name.
 */
export function Wordmark({
  size = "md",
  className,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const scale = {
    sm: { text: "text-base", suffix: "text-[0.7rem]", rule: "h-[3px]" },
    md: { text: "text-xl", suffix: "text-[0.8rem]", rule: "h-[3px]" },
    lg: { text: "text-2xl", suffix: "text-[0.9rem]", rule: "h-1" },
  }[size];

  const prefix = WORDMARK_PRIMARY.slice(0, 4); // "Find"
  const accented = WORDMARK_PRIMARY.slice(4); // "Food"

  return (
    <span
      aria-label={BRAND_NAME}
      className={cn("inline-flex items-baseline gap-1.5 font-extrabold tracking-tight", className)}
    >
      <span aria-hidden="true" className={cn(scale.text, "text-ink-900")}>
        {prefix}
        <span className="relative inline-block">
          {accented}
          <span
            className={cn(
              "absolute inset-x-0 -bottom-0.5 rounded-full bg-brand-400",
              scale.rule,
            )}
          />
        </span>
      </span>
      <span
        aria-hidden="true"
        className={cn(scale.suffix, "font-bold uppercase tracking-[0.14em] text-ink-400")}
      >
        {WORDMARK_SUFFIX}
      </span>
    </span>
  );
}
