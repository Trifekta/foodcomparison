import { z } from "zod";
import {
  MAX_CART_ITEMS,
  MAX_IMAGE_BYTES,
  MAX_ITEM_NAME_LENGTH,
  MAX_ITEM_QUANTITY,
  MAX_RESTAURANT_NAME_LENGTH,
  MAX_TOTAL_AED,
  MIN_TOTAL_AED,
  OTHER_APP_VALUE,
  SOURCE_APPS,
} from "@/lib/constants";
import { isNormalisablePhone } from "@/lib/utils/phone";

/**
 * Shared submission validation.
 *
 * The same rules run in the browser (instant feedback in the wizard) and again
 * on the server, which is the only place they are trusted.
 */

export const ERROR_MESSAGES = {
  cartMissing: "Please upload a screenshot of your cart.",
  invalidImage: "Please upload a JPG, PNG or WEBP image.",
  oversizedImage: "This image is larger than 10 MB.",
  restaurantMissing: "Please tell us which restaurant this order is from.",
  restaurantTooLong: `Keep the restaurant name under ${MAX_RESTAURANT_NAME_LENGTH} characters.`,
  itemsInvalid: "Please check the items you added.",
  areaMissing: "Please select your Dubai area.",
  appMissing: "Please choose the app you're ordering from.",
  otherAppMissing: "Please tell us the app name.",
  invalidTotal: "Enter the final amount you would pay.",
  totalTooHigh: `Enter an amount under AED ${MAX_TOTAL_AED.toLocaleString("en-AE")}.`,
  contactMissing: "Please tell us where to send your result.",
  invalidPhone: "Enter a valid mobile number.",
  invalidEmail: "Enter a valid email address.",
  network:
    "We couldn't submit your order. Your information hasn't been lost. Please try again.",
} as const;

/** Amount typed by the customer: positive, at most two decimals, sane ceiling. */
export const amountSchema = z
  .string()
  .trim()
  .min(1, ERROR_MESSAGES.invalidTotal)
  .regex(/^\d{1,7}(\.\d{1,2})?$/, ERROR_MESSAGES.invalidTotal)
  .refine((value) => Number(value) >= MIN_TOTAL_AED, ERROR_MESSAGES.invalidTotal)
  .refine((value) => Number(value) <= MAX_TOTAL_AED, ERROR_MESSAGES.totalTooHigh);

export const contactTypeSchema = z.enum(["whatsapp", "email"]);

/** The fields both the wizard and the API route validate. */
const baseFields = {
  restaurantName: z
    .string()
    .trim()
    .min(2, ERROR_MESSAGES.restaurantMissing)
    .max(MAX_RESTAURANT_NAME_LENGTH, ERROR_MESSAGES.restaurantTooLong),
  areaId: z.uuid({ message: ERROR_MESSAGES.areaMissing }),
  sourceApp: z.string().min(1, ERROR_MESSAGES.appMissing),
  sourceAppOther: z.string().trim().max(80),
  currentTotal: amountSchema,
  contactType: contactTypeSchema,
  dialCode: z.string(),
  whatsappNumber: z.string(),
  email: z.string(),
  marketingConsent: z.boolean(),
};

type BaseValues = {
  restaurantName: string;
  areaId: string;
  sourceApp: string;
  sourceAppOther: string;
  currentTotal: string;
  contactType: "whatsapp" | "email";
  dialCode: string;
  whatsappNumber: string;
  email: string;
  marketingConsent: boolean;
};

type ContactValues = Pick<
  BaseValues,
  "contactType" | "dialCode" | "whatsappNumber" | "email"
>;

/** Exactly one contact method must be valid, for the channel the customer chose. */
function checkContactRules(value: ContactValues, ctx: z.RefinementCtx): void {
  if (value.contactType === "whatsapp") {
    if (!value.whatsappNumber.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["whatsappNumber"],
        message: ERROR_MESSAGES.contactMissing,
      });
    } else if (!isNormalisablePhone(value.dialCode, value.whatsappNumber)) {
      ctx.addIssue({
        code: "custom",
        path: ["whatsappNumber"],
        message: ERROR_MESSAGES.invalidPhone,
      });
    }
  }

  if (value.contactType === "email") {
    if (!value.email.trim()) {
      ctx.addIssue({ code: "custom", path: ["email"], message: ERROR_MESSAGES.contactMissing });
    } else if (!z.email().safeParse(value.email.trim()).success) {
      ctx.addIssue({ code: "custom", path: ["email"], message: ERROR_MESSAGES.invalidEmail });
    }
  }
}

type AppValues = Pick<BaseValues, "sourceApp" | "sourceAppOther">;

/** The chosen app must be one we offer, and "Other" must be named. */
function checkAppRules(value: AppValues, ctx: z.RefinementCtx): void {
  if (!(SOURCE_APPS as readonly string[]).includes(value.sourceApp)) {
    ctx.addIssue({ code: "custom", path: ["sourceApp"], message: ERROR_MESSAGES.appMissing });
  }

  if (value.sourceApp === OTHER_APP_VALUE && !value.sourceAppOther.trim()) {
    ctx.addIssue({
      code: "custom",
      path: ["sourceAppOther"],
      message: ERROR_MESSAGES.otherAppMissing,
    });
  }
}

/** All cross-field rules. Used for the final submit and by the API route. */
function checkCrossFieldRules(value: BaseValues, ctx: z.RefinementCtx): void {
  checkAppRules(value, ctx);
  checkContactRules(value, ctx);
}

/** The whole submission, validated on the review step and again on the server. */
export const submissionFieldsSchema = z.object(baseFields).superRefine(checkCrossFieldRules);

/**
 * Per-step schemas.
 *
 * The wizard validates one step at a time, so each step gets its own schema.
 * A single object-level refinement would not do: cross-field rules on an object
 * schema only run once every field in that object parses, which would hide the
 * "Other" app error while a later step is still blank.
 */
export const basketStepSchema = z.object({ restaurantName: baseFields.restaurantName });

export const locationStepSchema = z
  .object({
    areaId: baseFields.areaId,
    sourceApp: baseFields.sourceApp,
    sourceAppOther: baseFields.sourceAppOther,
  })
  .superRefine(checkAppRules);

export const totalStepSchema = z.object({ currentTotal: amountSchema });

export const contactStepSchema = z
  .object({
    contactType: baseFields.contactType,
    dialCode: baseFields.dialCode,
    whatsappNumber: baseFields.whatsappNumber,
    email: baseFields.email,
  })
  .superRefine(checkContactRules);


/**
 * The optional item list.
 *
 * Kept out of submissionFieldsSchema because every other field is a string and
 * travels as one FormData entry; the items travel as a single JSON entry and
 * are parsed separately, on the client and again on the server.
 */
export const cartItemSchema = z.object({
  name: z.string().trim().min(1).max(MAX_ITEM_NAME_LENGTH),
  quantity: z.number().int().min(1).max(MAX_ITEM_QUANTITY),
});

export const cartItemsSchema = z.array(cartItemSchema).max(MAX_CART_ITEMS);

export type CartItem = z.infer<typeof cartItemSchema>;

export type SubmissionFields = z.infer<typeof submissionFieldsSchema>;

/**
 * Lightweight browser-side file check. The authoritative check is server-side in
 * lib/validation/image.ts, which reads the file's magic bytes.
 */
export function validateImageClientSide(file: File): string | null {
  if (file.size > MAX_IMAGE_BYTES) return ERROR_MESSAGES.oversizedImage;
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return ERROR_MESSAGES.invalidImage;
  return null;
}
