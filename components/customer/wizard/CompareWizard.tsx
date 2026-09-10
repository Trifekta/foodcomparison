"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch, type PathValue } from "react-hook-form";
import type { z } from "zod";
import type { PublicArea } from "@/types/database";
import {
  ERROR_MESSAGES,
  basketStepSchema,
  cartItemsSchema,
  contactStepSchema,
  locationStepSchema,
  submissionFieldsSchema,
  totalStepSchema,
} from "@/lib/validation/submission";
import { WizardShell } from "./WizardShell";
import { StepUpload } from "./StepUpload";
import { StepBasket } from "./StepBasket";
import { StepLocation } from "./StepLocation";
import { StepTotal } from "./StepTotal";
import { StepContact } from "./StepContact";
import { StepReview } from "./StepReview";
import type { ExtractionResponse } from "@/lib/extraction/schema";
import {
  WIZARD_DEFAULTS,
  usableItems,
  type CartItemDraft,
  type ExtractionStatus,
  type WizardFiles,
  type WizardValues,
} from "./types";

const STEP_UPLOAD = 1;
const STEP_BASKET = 2;
const STEP_LOCATION = 3;
const STEP_TOTAL = 4;
const STEP_CONTACT = 5;
const STEP_REVIEW = 6;

/**
 * The customer wizard.
 *
 * react-hook-form owns the field state and the error store; validation runs
 * per step against the matching Zod schema (see lib/validation/submission.ts)
 * and once more over the whole submission before it is sent. The server
 * re-validates everything regardless - nothing here is trusted.
 */
export function CompareWizard({ areas }: { areas: PublicArea[] }) {
  const router = useRouter();

  const {
    control,
    setValue,
    setError,
    clearErrors,
    getValues,
    formState: { errors },
  } = useForm<WizardValues>({ defaultValues: WIZARD_DEFAULTS, mode: "onSubmit" });

  // useWatch (rather than watch()) subscribes to the field values without
  // handing the React Compiler an unmemoizable function.
  const values = useWatch({ control, defaultValue: WIZARD_DEFAULTS }) as WizardValues;

  const [step, setStep] = useState<number>(STEP_UPLOAD);
  const [files, setFiles] = useState<WizardFiles>({ cart: null, checkout: null });
  // Items are an array of objects, so they live here rather than in
  // react-hook-form, whose values all travel as single FormData entries.
  const [items, setItems] = useState<CartItemDraft[]>([]);
  const [extractionStatus, setExtractionStatus] = useState<ExtractionStatus>("idle");
  // The total printed on the screenshot, offered as a hint on the total step.
  // Never filled in silently: that number is the baseline for the saving we
  // quote, so the customer states it themselves.
  const [readTotal, setReadTotal] = useState<string | null>(null);
  // Identifies the newest read, so a slow reply for a replaced screenshot loses.
  const extractionRun = useRef(0);
  const [cartError, setCartError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Guards against a double tap firing two submissions before state settles.
  const submitLock = useRef(false);

  const setField = <K extends keyof WizardValues & string>(
    name: K,
    value: PathValue<WizardValues, K>,
  ) => {
    setValue(name, value);
    clearErrors(name);
  };

  /** Runs one step's schema and pushes any issues into the form error store. */
  const validateStep = (schema: z.ZodType<unknown>, fields: Array<keyof WizardValues>): boolean => {
    clearErrors(fields);
    const result = schema.safeParse(getValues());
    if (result.success) return true;

    for (const issue of result.error.issues) {
      const field = issue.path[0] as keyof WizardValues | undefined;
      if (field) setError(field, { type: "manual", message: issue.message });
    }
    return false;
  };

  /**
   * Reads the cart screenshot in the background while the customer walks to the
   * confirm step. Failure is silent by design: the feature is a convenience, and
   * the wizard works exactly as it did before it existed.
   */
  const startExtraction = (file: File) => {
    const run = extractionRun.current + 1;
    extractionRun.current = run;
    setExtractionStatus("reading");
    setReadTotal(null);

    const body = new FormData();
    body.append("cartImage", file);

    void fetch("/api/extract", { method: "POST", body })
      .then((response) => (response.ok ? (response.json() as Promise<ExtractionResponse>) : null))
      .then((data) => {
        if (run !== extractionRun.current) return;

        if (!data || !data.readable) {
          setExtractionStatus("empty");
          return;
        }

        setReadTotal(data.orderTotal);

        // Never overwrite something the customer has already entered - they may
        // have typed ahead while the read was in flight.
        let applied = false;

        if (data.restaurantName && !getValues("restaurantName").trim()) {
          setValue("restaurantName", data.restaurantName);
          clearErrors("restaurantName");
          applied = true;
        }

        setItems((current) => {
          if (current.length > 0 || data.items.length === 0) return current;
          applied = true;
          return data.items.map((item) => ({
            key: crypto.randomUUID(),
            name: item.name,
            quantity: item.quantity,
            linePrice: item.linePrice,
            proposed: {
              name: item.name,
              quantity: item.quantity,
              linePrice: item.linePrice,
            },
          }));
        });

        setExtractionStatus(applied ? "applied" : "empty");
      })
      .catch(() => {
        if (run === extractionRun.current) setExtractionStatus("failed");
      });
  };

  const goTo = (next: number) => {
    setStep(next);
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  };

  const handleUploadContinue = () => {
    if (!files.cart) {
      setCartError(ERROR_MESSAGES.cartMissing);
      return;
    }
    setCartError(null);
    goTo(STEP_BASKET);
  };

  const handleBasketContinue = () => {
    if (validateStep(basketStepSchema, ["restaurantName"])) goTo(STEP_LOCATION);
  };

  const handleLocationContinue = () => {
    if (validateStep(locationStepSchema, ["areaId", "sourceApp", "sourceAppOther"])) {
      goTo(STEP_TOTAL);
    }
  };

  const handleTotalContinue = () => {
    if (validateStep(totalStepSchema, ["currentTotal"])) goTo(STEP_CONTACT);
  };

  const handleContactContinue = () => {
    if (
      validateStep(contactStepSchema, ["contactType", "dialCode", "whatsappNumber", "email"])
    ) {
      goTo(STEP_REVIEW);
    }
  };

  const handleSubmit = async () => {
    if (submitLock.current) return;

    if (!files.cart) {
      setCartError(ERROR_MESSAGES.cartMissing);
      goTo(STEP_UPLOAD);
      return;
    }

    const parsed = submissionFieldsSchema.safeParse(getValues());
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof WizardValues | undefined;
        if (field) setError(field, { type: "manual", message: issue.message });
      }
      // Send the customer back to the earliest step that still needs attention.
      const bad = parsed.error.issues[0]?.path[0];
      if (bad === "restaurantName") goTo(STEP_BASKET);
      else if (bad === "areaId" || bad === "sourceApp" || bad === "sourceAppOther") goTo(STEP_LOCATION);
      else if (bad === "currentTotal") goTo(STEP_TOTAL);
      else goTo(STEP_CONTACT);
      return;
    }

    submitLock.current = true;
    setSubmitting(true);
    setSubmitError(null);

    try {
      const body = new FormData();
      body.append("cartImage", files.cart);
      if (files.checkout) body.append("checkoutImage", files.checkout);
      for (const [key, value] of Object.entries(parsed.data)) {
        body.append(key, typeof value === "boolean" ? String(value) : value);
      }

      // Sent as one JSON entry, and re-parsed and re-validated on the server.
      const cartItems = cartItemsSchema.safeParse(usableItems(items));
      if (cartItems.success && cartItems.data.length > 0) {
        body.append("items", JSON.stringify(cartItems.data));
      }

      const response = await fetch("/api/submissions", { method: "POST", body });
      const payload = (await response.json().catch(() => null)) as
        | { referenceNumber?: string; error?: string }
        | null;

      if (!response.ok || !payload?.referenceNumber) {
        setSubmitError(payload?.error ?? ERROR_MESSAGES.network);
        return;
      }

      router.replace(`/success?ref=${encodeURIComponent(payload.referenceNumber)}`);
      return;
    } catch {
      setSubmitError(ERROR_MESSAGES.network);
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  };

  const areaName = areas.find((area) => area.id === values.areaId)?.name ?? "";

  return (
    <WizardShell
      step={step}
      stepLabel={step === STEP_REVIEW ? "Review" : undefined}
      onBack={step === STEP_UPLOAD ? null : () => goTo(step - 1)}
    >
      {step === STEP_UPLOAD ? (
        <StepUpload
          cartFile={files.cart}
          checkoutFile={files.checkout}
          onCartChange={(file: File | null) => {
            setFiles((current) => ({ ...current, cart: file }));
            setCartError(null);
            if (file) {
              startExtraction(file);
            } else {
              extractionRun.current += 1;
              setExtractionStatus("idle");
              setReadTotal(null);
            }
          }}
          onCheckoutChange={(file: File | null) =>
            setFiles((current) => ({ ...current, checkout: file }))
          }
          error={cartError}
          onContinue={handleUploadContinue}
        />
      ) : null}

      {step === STEP_BASKET ? (
        <StepBasket
          restaurantName={values.restaurantName}
          items={items}
          restaurantError={errors.restaurantName?.message}
          extractionStatus={extractionStatus}
          onRestaurantNameChange={(value) => setField("restaurantName", value)}
          onItemsChange={setItems}
          onContinue={handleBasketContinue}
        />
      ) : null}

      {step === STEP_LOCATION ? (
        <StepLocation
          areas={areas}
          areaId={values.areaId}
          sourceApp={values.sourceApp}
          sourceAppOther={values.sourceAppOther}
          errors={{
            areaId: errors.areaId?.message,
            sourceApp: errors.sourceApp?.message,
            sourceAppOther: errors.sourceAppOther?.message,
          }}
          onAreaChange={(areaId) => setField("areaId", areaId)}
          onSourceAppChange={(app) => setField("sourceApp", app)}
          onSourceAppOtherChange={(name) => setField("sourceAppOther", name)}
          onContinue={handleLocationContinue}
        />
      ) : null}

      {step === STEP_TOTAL ? (
        <StepTotal
          currentTotal={values.currentTotal}
          onCurrentTotalChange={(value) => setField("currentTotal", value)}
          totalError={errors.currentTotal?.message}
          hasCheckoutScreenshot={files.checkout !== null}
          readTotal={readTotal}
          onUseReadTotal={() => {
            if (readTotal) setField("currentTotal", readTotal);
          }}
          onContinue={handleTotalContinue}
        />
      ) : null}

      {step === STEP_CONTACT ? (
        <StepContact
          contactType={values.contactType}
          dialCode={values.dialCode}
          whatsappNumber={values.whatsappNumber}
          email={values.email}
          marketingConsent={values.marketingConsent}
          errors={{
            whatsappNumber: errors.whatsappNumber?.message,
            email: errors.email?.message,
          }}
          onContactTypeChange={(type) => {
            setField("contactType", type);
            clearErrors(["whatsappNumber", "email"]);
          }}
          onDialCodeChange={(code) => setField("dialCode", code)}
          onWhatsappNumberChange={(value) => setField("whatsappNumber", value)}
          onEmailChange={(value) => setField("email", value)}
          onMarketingConsentChange={(value) => setField("marketingConsent", value)}
          onContinue={handleContactContinue}
        />
      ) : null}

      {step === STEP_REVIEW ? (
        <StepReview
          values={values}
          files={files}
          items={usableItems(items)}
          areaName={areaName}
          submitting={submitting}
          submitError={submitError}
          onSubmit={() => void handleSubmit()}
          onBack={() => goTo(STEP_CONTACT)}
          onEditBasket={() => goTo(STEP_BASKET)}
          onEditArea={() => goTo(STEP_LOCATION)}
          onEditContact={() => goTo(STEP_CONTACT)}
        />
      ) : null}
    </WizardShell>
  );
}
