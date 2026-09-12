import { z } from "zod";
import { MAX_RESTAURANT_NAME_LENGTH, MAX_TOTAL_AED } from "@/lib/constants";
import { isNormalisablePhone } from "@/lib/utils/phone";

/** Validation for the admin comparison workflow. */

export const comparisonTotalSchema = z
  .string()
  .trim()
  .min(1, "Enter the Keeta total.")
  .regex(/^\d{1,7}(\.\d{1,2})?$/, "Enter a valid amount, e.g. 63.00")
  .refine((value) => Number(value) >= 0, "Amount cannot be negative")
  .refine(
    (value) => Number(value) <= MAX_TOTAL_AED,
    `Enter an amount under AED ${MAX_TOTAL_AED.toLocaleString("en-AE")}.`,
  );

export const comparisonInputSchema = z.object({
  submissionId: z.uuid(),
  /**
   * Which app the customer ordered from, as identified by the admin from the
   * screenshot. Optional so an older form, or one left alone, changes nothing.
   */
  sourceApp: z.string().trim().max(80).optional(),
  comparisonTotal: comparisonTotalSchema,
  /**
   * The restaurant's page on the comparison app, pasted from the page the
   * admin is already looking at.
   *
   * Required, not optional. It becomes the "Take me to Keeta" button, which is
   * the single action the whole product exists to produce - without it the
   * customer is shown a saving and given no way to act on it, and the last step
   * of the funnel can never fire, so nobody can even tell that nobody switched.
   * It was optional, and one forgotten paste silently cost a conversion.
   *
   * The admin is already on the page they are copying, so this asks for nothing
   * they do not have in front of them. Recording that a basket could not be
   * compared at all goes through markUnavailable, which has no link to give.
   */
  comparisonUrl: z
    .string()
    .trim()
    .min(1, "Paste the restaurant's link from the comparison app — it becomes the customer's button.")
    .max(500)
    .refine(
      (value) => /^https:\/\/\S+$/i.test(value),
      "Paste the full https:// link from the app.",
    ),
  restaurantFound: z.string().trim().max(160).optional(),
  comparisonLocationNote: z.string().trim().max(160).optional(),
  adminNotes: z.string().trim().max(2000).optional(),
});

export type ComparisonInput = z.infer<typeof comparisonInputSchema>;

/**
 * The outcome with no number in it.
 *
 * Deliberately a separate schema from the comparison above: that one demands a
 * total, and demanding one here is exactly the bug this fixes - there is no
 * total to give, which is the whole point.
 */
export const unavailableInputSchema = z.object({
  submissionId: z.uuid(),
  reason: z.enum(["restaurant_not_listed", "items_not_available", "other"]),
  adminNotes: z.string().trim().max(2000).optional(),
});

export type UnavailableInput = z.infer<typeof unavailableInputSchema>;

export const areaInputSchema = z.object({
  name: z.string().trim().min(2, "Area name is too short").max(80),
  active: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(9999).default(100),
  testLocationLabel: z.string().trim().max(120).optional(),
  adminLocationNotes: z.string().trim().max(500).optional(),
});

export type AreaInput = z.infer<typeof areaInputSchema>;

export const adminCredentialsSchema = z.object({
  email: z.email({ message: "Enter a valid email address." }),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

/**
 * Correcting a submission after it has arrived.
 *
 * The customer's own numbers, not ours: what they said they were paying, where
 * they are, which restaurant, and how to reach them. Everything the comparison
 * produces - the Keeta total, the saving, the message - is left to
 * saveComparison, because those are derived and recomputing them by hand here
 * would be a second source of truth for the arithmetic.
 *
 * The total is the one that matters most. It is the baseline the whole saving
 * is measured against, so a customer who typed 85.69 when they meant 86.59
 * makes every number downstream wrong, and before this there was no way to put
 * it right.
 */
export const currentTotalSchema = z
  .string()
  .trim()
  .min(1, "Enter the amount the customer is paying.")
  .regex(/^\d{1,7}(\.\d{1,2})?$/, "Enter a valid amount, e.g. 85.69")
  .refine((value) => Number(value) > 0, "Amount must be more than zero.")
  .refine(
    (value) => Number(value) <= MAX_TOTAL_AED,
    `Enter an amount under AED ${MAX_TOTAL_AED.toLocaleString("en-AE")}.`,
  );

export const submissionEditSchema = z
  .object({
    submissionId: z.uuid(),
    restaurantName: z.string().trim().max(MAX_RESTAURANT_NAME_LENGTH).optional(),
    areaId: z.uuid({ message: "Choose the customer's area." }),
    currentTotal: currentTotalSchema,
    sourceApp: z.string().trim().max(80),
    contactType: z.enum(["whatsapp", "email"]),
    dialCode: z.string().trim().max(8),
    whatsappNumber: z.string().trim().max(40),
    email: z.string().trim().max(200),
  })
  .superRefine((value, ctx) => {
    // The same rule the wizard enforces: exactly one channel, and it has to be
    // a real one. An admin correcting a typo must not be able to leave the
    // submission with no way to answer it.
    if (value.contactType === "whatsapp") {
      if (!isNormalisablePhone(value.dialCode, value.whatsappNumber)) {
        ctx.addIssue({
          code: "custom",
          path: ["whatsappNumber"],
          message: "Enter a valid mobile number.",
        });
      }
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.email)) {
      ctx.addIssue({ code: "custom", path: ["email"], message: "Enter a valid email address." });
    }
  });

export type SubmissionEditInput = z.infer<typeof submissionEditSchema>;
