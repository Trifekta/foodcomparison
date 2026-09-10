import { BRAND_NAME } from "@/lib/constants";

/**
 * Trademark-neutral disclaimer. Platform names are used descriptively only, in
 * plain text, with no logos or brand styling.
 */
export function Disclaimer({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs leading-relaxed text-ink-400 ${className}`}>
      {BRAND_NAME} is an independent comparison service and is not affiliated with Talabat, Keeta,
      Careem, Deliveroo or Noon Food. All product and company names are trademarks of their
      respective owners.
    </p>
  );
}
