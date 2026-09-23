import { z } from "zod";
import type { WizardValues } from "@/components/customer/wizard/types";

/**
 * What a wizard draft holds besides its screenshots.
 *
 * Deliberately looser than the submission schema - this is work in progress, a
 * half-typed total or an unanswered question is exactly what it must keep -
 * but bounded everywhere, because it arrives from a browser and is stored.
 *
 * The WhatsApp number is not a field here. z.object strips unknown keys, so a
 * client that sends one anyway has it dropped before anything is written.
 */

const text = (max: number) => z.string().max(max);

const totalsSchema = z.object({
  subtotal: text(32),
  deliveryFee: text(32),
  serviceFee: text(32),
  discount: text(32),
  finalTotal: text(32),
});

/** A finished read of one screenshot. "reading" is never stored: it does not survive a reload. */
const readSchema = z.object({
  status: z.enum(["applied", "empty"]),
  totals: totalsSchema.nullable(),
});

const proposedSchema = z.object({
  name: text(400),
  quantity: z.number().int().min(0).max(999),
  linePrice: text(32).nullable(),
});

const itemSchema = z.object({
  key: text(64),
  name: text(400),
  quantity: z.number().int().min(0).max(999),
  linePrice: text(32).nullable(),
  priceUncertain: z.boolean().optional(),
  proposed: proposedSchema.nullable(),
});

export const draftValuesSchema = z.object({
  restaurantName: text(400),
  areaId: text(64),
  currentTotal: text(32),
  newToKeeta: z.enum(["", "yes", "no"]),
  dialCode: text(8),
  marketingConsent: z.boolean(),
});

export const draftProgressSchema = z.object({
  step: z.union([z.literal(1), z.literal(2)]),
  values: draftValuesSchema,
  items: z.array(itemSchema).max(60),
  autofilled: text(32).nullable(),
  reads: z.object({
    cart: readSchema.nullable(),
    checkout: readSchema.nullable(),
  }),
});

export type DraftProgress = z.infer<typeof draftProgressSchema>;
export type DraftValues = z.infer<typeof draftValuesSchema>;

/** Everything the form holds except the phone number. */
export function draftValuesFrom(values: WizardValues): DraftValues {
  return {
    restaurantName: values.restaurantName,
    areaId: values.areaId,
    currentTotal: values.currentTotal,
    newToKeeta: values.newToKeeta,
    dialCode: values.dialCode,
    marketingConsent: values.marketingConsent,
  };
}

/** Largest JSON body the progress endpoints accept. */
export const MAX_PROGRESS_BYTES = 48 * 1024;
