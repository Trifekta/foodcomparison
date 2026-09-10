import type { SubmissionFields } from "@/lib/validation/submission";

/** Text values held by react-hook-form. Files live in component state. */
export type WizardValues = SubmissionFields;

export interface WizardFiles {
  cart: File | null;
  checkout: File | null;
}

export const TOTAL_STEPS = 4;

export const WIZARD_DEFAULTS: WizardValues = {
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
