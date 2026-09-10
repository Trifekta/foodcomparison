import type { CartItem, SubmissionFields } from "@/lib/validation/submission";

/** Text values held by react-hook-form. Files and items live in component state. */
export type WizardValues = SubmissionFields;

export interface WizardFiles {
  cart: File | null;
  checkout: File | null;
}

/**
 * A row in the optional item list, as it is being typed.
 *
 * `quantity` is a number because the stepper is the only way to change it, so
 * it can never hold a half-typed value; `name` is free text and a blank row is
 * simply one the customer has not filled in. `key` is a stable React key that
 * survives reordering and deletion - the name is not unique enough for that.
 */
export interface CartItemDraft extends CartItem {
  key: string;
}

export const TOTAL_STEPS = 5;

export const WIZARD_DEFAULTS: WizardValues = {
  restaurantName: "",
  areaId: "",
  sourceApp: "",
  sourceAppOther: "",
  currentTotal: "",
  contactType: "whatsapp",
  dialCode: "+971",
  whatsappNumber: "",
  email: "",
  marketingConsent: false,
};
