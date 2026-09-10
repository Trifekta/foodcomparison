import { z } from "zod";
import { MAX_TOTAL_AED } from "@/lib/constants";

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
  comparisonTotal: comparisonTotalSchema,
  restaurantFound: z.string().trim().max(160).optional(),
  comparisonLocationNote: z.string().trim().max(160).optional(),
  adminNotes: z.string().trim().max(2000).optional(),
});

export type ComparisonInput = z.infer<typeof comparisonInputSchema>;

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
