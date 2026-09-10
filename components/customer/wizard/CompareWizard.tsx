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
import {
  WIZARD_DEFAULTS,
  usableItems,
  type CartItemDraft,
  type ExtractionStatus,
  type ReadTotals,
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
  const [readTotals, setReadTotals] = useState<ReadTotals | null>(null);
  // Identifies the newest read, so a slow one for a replaced screenshot loses.
  const readRun = useRef(0);
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
   * Reads the screenshot on the customer's own device while they walk to the
   * confirm step. No server, no API, no cost - tesseract.js in this browser,
   * then a rules parser. It is rougher than a model would be, which is exactly
   * why the next screen is editable and asks them to confirm.
   *
   * Failure is silent: the confirm step simply starts empty, as it did before
   * any of this existed.
   */
  const startRead = (file: File) => {
    const run = readRun.current + 1;
    readRun.current = run;
    setExtractionStatus("reading");
    setReadTotals(null);

    void (async () => {
      try {
        const [{ readImageInBrowser }, { parseOcrText }] = await Promise.all([
          import("@/lib/ocr/browser"),
          import("@/lib/extraction/parse-text"),
        ]);

        const ocr = await readImageInBrowser(file);
        if (run !== readRun.current) return;
        if (!ocr.ok) {
          setExtractionStatus("empty");
          return;
        }

        const { basket, empty } = parseOcrText(ocr.text);
        if (run !== readRun.current) return;

        if (empty) {
          setExtractionStatus("empty");
          return;
        }

        setReadTotals({
          subtotal: basket.subtotal,
          deliveryFee: basket.delivery_fee,
          serviceFee: basket.service_fee,
          discount: basket.discount,
          finalTotal: basket.final_total,
        });

        // Never overwrite something the customer typed while waiting.
        let applied = false;

        if (basket.restaurant_name && !getValues("restaurantName").trim()) {
          setValue("restaurantName", basket.restaurant_name);
          clearErrors("restaurantName");
          applied = true;
        }

        const flagged = new Set(basket.uncertain_fields);

        setItems((current) => {
          if (current.length > 0 || basket.items.length === 0) return current;
          applied = true;
          return basket.items.map((item, index) => ({
            key: crypto.randomUUID(),
            name: [item.name, ...item.modifiers].join(" · ").slice(0, 120),
            quantity: item.quantity,
            linePrice: item.line_total || null,
            priceUncertain: flagged.has(`items[${index}].line_total`) && item.line_total !== "",
            proposed: {
              name: [item.name, ...item.modifiers].join(" · ").slice(0, 120),
              quantity: item.quantity,
              linePrice: item.line_total || null,
            },
          }));
        });

        setExtractionStatus(applied ? "applied" : "empty");
      } catch {
        if (run === readRun.current) setExtractionStatus("empty");
      }
    })();
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
          onCartChange={(file: File | null, original?: File | null) => {
            setFiles((current) => ({ ...current, cart: file }));
            setCartError(null);
            if (file) {
              // Read the original, not the compressed upload: JPEG artifacts on
              // small text cost far more accuracy than the extra pixels cost time.
              startRead(original ?? file);
            } else {
              readRun.current += 1;
              setExtractionStatus("idle");
              setReadTotals(null);
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
          readTotals={readTotals}
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
          readTotal={readTotals?.finalTotal || null}
          onUseReadTotal={() => {
            const total = readTotals?.finalTotal;
            if (total) setField("currentTotal", total);
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
