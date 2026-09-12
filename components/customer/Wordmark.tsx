import { WORDMARK_PRIMARY, WORDMARK_ACCENT, BRAND_NAME } from "@/lib/constants";
import { Sparks } from "@/components/customer/Motifs";
import { cn } from "@/lib/utils/cn";

/**
 * The SnipSavor lockup: "Snip" inside a screenshot crop frame, then "Savor" in
 * gold, finished with the spark motif the rest of the product already uses.
 *
 * The four corner brackets are the mark. They say "screenshot" without a word,
 * which is the one thing a customer has to understand before anything else
 * works - they are being asked for a picture of their cart, and nothing about a
 * price comparison explains that on its own.
 *
 * Drawn rather than dropped in as an image, for three reasons: it stays sharp
 * at every size from the admin navbar to the landing page, it costs about a
 * kilobyte rather than half a megabyte on a first visit over 4G, and the words
 * stay words - so the accessible name is the brand name itself, not alt text
 * somebody forgets to update.
 *
 * The two halves come from constants, so renaming the product means editing
 * lib/constants.ts and nothing else.
 */

/**
 * Sizes are spelled out rather than assembled.
 *
 * Tailwind reads class names out of the source as plain text, so a class built
 * from a template string at runtime is a class that never gets generated. Every
 * corner of every size therefore appears here in full, which is duller to read
 * and the only version that actually renders.
 */
const SCALE = {
  sm: {
    text: "text-base",
    frame: "px-1.5 py-0.5",
    arm: "h-1.5 w-1.5",
    spark: "h-2.5 w-2.5",
    corners: {
      tl: "left-0 top-0 border-l-[1.5px] border-t-[1.5px] rounded-tl-[2px]",
      tr: "right-0 top-0 border-r-[1.5px] border-t-[1.5px] rounded-tr-[2px]",
      bl: "bottom-0 left-0 border-b-[1.5px] border-l-[1.5px] rounded-bl-[2px]",
      br: "bottom-0 right-0 border-b-[1.5px] border-r-[1.5px] rounded-br-[2px]",
    },
  },
  md: {
    text: "text-xl",
    frame: "px-2 py-1",
    arm: "h-2 w-2",
    spark: "h-3.5 w-3.5",
    corners: {
      tl: "left-0 top-0 border-l-2 border-t-2 rounded-tl-[3px]",
      tr: "right-0 top-0 border-r-2 border-t-2 rounded-tr-[3px]",
      bl: "bottom-0 left-0 border-b-2 border-l-2 rounded-bl-[3px]",
      br: "bottom-0 right-0 border-b-2 border-r-2 rounded-br-[3px]",
    },
  },
  lg: {
    text: "text-2xl",
    frame: "px-2.5 py-1.5",
    arm: "h-2.5 w-2.5",
    spark: "h-4 w-4",
    corners: {
      tl: "left-0 top-0 border-l-2 border-t-2 rounded-tl-[4px]",
      tr: "right-0 top-0 border-r-2 border-t-2 rounded-tr-[4px]",
      bl: "bottom-0 left-0 border-b-2 border-l-2 rounded-bl-[4px]",
      br: "bottom-0 right-0 border-b-2 border-r-2 rounded-br-[4px]",
    },
  },
} as const;

export function Wordmark({
  size = "md",
  className,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const scale = SCALE[size];
  const corner = cn("pointer-events-none absolute border-brand-500", scale.arm);

  return (
    <span
      role="img"
      aria-label={BRAND_NAME}
      className={cn(
        "inline-flex items-center gap-[0.14em] font-extrabold tracking-tight",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "relative inline-flex items-center text-ink-900",
          scale.frame,
          scale.text,
        )}
      >
        <span className={cn(corner, scale.corners.tl)} />
        <span className={cn(corner, scale.corners.tr)} />
        <span className={cn(corner, scale.corners.bl)} />
        <span className={cn(corner, scale.corners.br)} />
        {WORDMARK_PRIMARY}
      </span>

      <span aria-hidden="true" className={cn(scale.text, "text-brand-600")}>
        {WORDMARK_ACCENT}
      </span>

      <Sparks className={cn(scale.spark, "shrink-0 self-start")} />
    </span>
  );
}
