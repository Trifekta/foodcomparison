import { amountSchema } from "@/lib/validation/submission";

export const breakdownLabels = {
  subtotal: "Food subtotal",
  delivery: "Delivery fee",
  service: "Service fee",
  discount: "Discount (AED)",
} as const;
export type Breakdown = Record<keyof typeof breakdownLabels, string>;
export interface ManualTotalState {
  mode: "breakdown" | "direct" | null;
  parts: Breakdown | null;
}

/** Integer fils avoid rounding errors when adding and subtracting currency. */
export function calculateManualTotal(parts: Breakdown) {
  const errors: Partial<Record<keyof Breakdown, string>> = {};
  const fils = {} as Record<keyof Breakdown, number>;
  for (const key of Object.keys(breakdownLabels) as (keyof Breakdown)[]) {
    const value = parts[key].trim();
    if (!/^\d{1,7}(\.\d{1,2})?$/.test(value)) {
      errors[key] = value ? "Enter a valid AED amount." : key === "subtotal" ? "Enter your food subtotal." : "Enter an amount, or 0 if none.";
    } else {
      fils[key] = Math.round(Number(value) * 100);
    }
  }
  if (Object.keys(errors).length) return { total: "", errors, totalError: undefined };
  const total = ((fils.subtotal + fils.delivery + fils.service - fils.discount) / 100).toFixed(2);
  const parsed = amountSchema.safeParse(total);
  return {
    total: parsed.success ? total : "",
    errors,
    totalError: parsed.success ? undefined : "Check the amounts: final total must be above AED 0 and at most AED 5,000.",
  };
}
