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
  submissionFieldsSchema,
  whereStepSchema,
} from "@/lib/validation/submission";
import { rememberLastOrder } from "@/lib/utils/last-order";
import { WizardShell } from "./WizardShell";
import { StepUpload } from "./StepUpload";
import { StepBasket } from "./StepBasket";
import { StepWhereAndTotal } from "./StepWhereAndTotal";
import { StepReview } from "./StepReview";
import {
  WIZARD_DEFAULTS,
  combineStatus,
  hasAnyTotal,
  mergeReadTotals,
  usableItems,
  type CartItemDraft,
  type ExtractionStatus,
  type ReadSlot,
  type ReadTotals,
  type WizardFiles,
  type WizardValues,
} from "./types";

const STEP_UPLOAD = 1;
const STEP_BASKET = 2;
const STEP_WHERE = 3;
const STEP_REVIEW = 4;

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
  // Both screenshots are read, and each is tracked on its own: they are chosen
  // at different moments and can finish in either order.
  const [cartStatus, setCartStatus] = useState<ExtractionStatus>("idle");
  const [checkoutStatus, setCheckoutStatus] = useState<ExtractionStatus>("idle");
  const [cartTotals, setCartTotals] = useState<ReadTotals | null>(null);
  const [checkoutTotals, setCheckoutTotals] = useState<ReadTotals | null>(null);
  // Identifies the newest read per slot, so a slow one for a replaced
  // screenshot loses to the read for the screenshot now on screen.
  const readRuns = useRef<Record<ReadSlot, number>>({ cart: 0, checkout: 0 });
  const [cartError, setCartError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Guards against a double tap firing two submissions before state settles.
  const submitLock = useRef(false);

  const setStatus = (slot: ReadSlot, status: ExtractionStatus) => {
    if (slot === "cart") setCartStatus(status);
    else setCheckoutStatus(status);
  };

  const setTotals = (slot: ReadSlot, totals: ReadTotals | null) => {
    if (slot === "cart") setCartTotals(totals);
    else setCheckoutTotals(totals);
  };

  /** Abandons whatever is in flight for a slot and forgets what it read. */
  const clearRead = (slot: ReadSlot) => {
    readRuns.current[slot] += 1;
    setStatus(slot, "idle");
    setTotals(slot, null);
  };

  const extractionStatus = combineStatus(cartStatus, checkoutStatus);
  const readTotals = mergeReadTotals(cartTotals, checkoutTotals);
  const totalsFromCheckout = hasAnyTotal(checkoutTotals);

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
   * Reads a screenshot on the customer's own device while they walk to the
   * confirm step. No server, no API, no cost - tesseract.js in this browser,
   * then a rules parser. It is rougher than a model would be, which is exactly
   * why the next screen is editable and asks them to confirm.
   *
   * The cart screenshot is read for everything; the payment screenshot only
   * for its money, because it is the screen where the money is settled and the
   * cart screen is the one that lists what was ordered.
   *
   * Failure is silent: the confirm step simply starts empty, as it did before
   * any of this existed.
   */
  const startRead = (file: File, slot: ReadSlot) => {
    const run = readRuns.current[slot] + 1;
    readRuns.current[slot] = run;
    const stillCurrent = () => run === readRuns.current[slot];

    setStatus(slot, "reading");
    setTotals(slot, null);

    void (async () => {
      try {
        const [{ readImageInBrowser }, { parseOcrText }] = await Promise.all([
          import("@/lib/ocr/browser"),
          import("@/lib/extraction/parse-text"),
        ]);

        const ocr = await readImageInBrowser(file);
        if (!stillCurrent()) return;
        if (!ocr.ok) {
          setStatus(slot, "empty");
          return;
        }

        const { basket, empty } = parseOcrText(ocr.text);
        if (!stillCurrent()) return;

        if (empty) {
          setStatus(slot, "empty");
          return;
        }

        const totals: ReadTotals = {
          subtotal: basket.subtotal,
          deliveryFee: basket.delivery_fee,
          serviceFee: basket.service_fee,
          discount: basket.discount,
          finalTotal: basket.final_total,
        };
        setTotals(slot, totals);

        if (slot === "checkout") {
          // Nothing else off this screen: a payment screen that happens to
          // list items lists them without their options, and the cart screen
          // has already answered that question properly.
          setStatus(slot, hasAnyTotal(totals) ? "applied" : "empty");
          return;
        }

        // Never overwrite something the customer typed while waiting.
        let applied = hasAnyTotal(totals);

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

        setStatus(slot, applied ? "applied" : "empty");
      } catch {
        if (stillCurrent()) setStatus(slot, "empty");
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
    if (validateStep(basketStepSchema, ["restaurantName"])) goTo(STEP_WHERE);
  };

  const handleWhereContinue = () => {
    if (validateStep(whereStepSchema, ["areaId", "currentTotal"])) goTo(STEP_REVIEW);
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
      // Contact is asked on this screen, so a contact problem stays here.
      const bad = parsed.error.issues[0]?.path[0];
      if (bad === "restaurantName") goTo(STEP_BASKET);
      else if (bad === "areaId" || bad === "currentTotal") goTo(STEP_WHERE);
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
        | { referenceNumber?: string; resultPath?: string; error?: string }
        | null;

      if (!response.ok || !payload?.resultPath) {
        setSubmitError(payload?.error ?? ERROR_MESSAGES.network);
        return;
      }

      // Kept on this device so coming back to the site finds the order without
      // anybody typing a reference.
      if (payload.referenceNumber) {
        rememberLastOrder(payload.referenceNumber, payload.resultPath);
      }

      // Straight to their own result page, which starts out saying we are
      // checking and turns into the answer without them doing anything.
      router.replace(payload.resultPath);
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
      onBack={step === STEP_UPLOAD ? null : () => goTo(step - 1)}
    >
      {step === STEP_UPLOAD ? (
        <StepUpload
          cartFile={files.cart}
          checkoutFile={files.checkout}
          onCartChange={(file: File | null, original?: File | null) => {
            setFiles((current) => ({ ...current, cart: file }));
            setCartError(null);
            // Read the original, not the compressed upload: JPEG artifacts on
            // small text cost far more accuracy than the extra pixels cost time.
            if (file) startRead(original ?? file, "cart");
            else clearRead("cart");
          }}
          onCheckoutChange={(file: File | null, original?: File | null) => {
            setFiles((current) => ({ ...current, checkout: file }));
            if (file) startRead(original ?? file, "checkout");
            else clearRead("checkout");
          }}
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
          totalsFromCheckout={totalsFromCheckout}
          onRestaurantNameChange={(value) => setField("restaurantName", value)}
          onItemsChange={setItems}
          onContinue={handleBasketContinue}
        />
      ) : null}

      {step === STEP_WHERE ? (
        <StepWhereAndTotal
          areas={areas}
          areaId={values.areaId}
          currentTotal={values.currentTotal}
          errors={{ areaId: errors.areaId?.message, currentTotal: errors.currentTotal?.message }}
          hasCheckoutScreenshot={files.checkout !== null}
          readTotal={readTotals?.finalTotal || null}
          totalFromCheckout={totalsFromCheckout && checkoutTotals.finalTotal !== ""}
          onAreaChange={(areaId) => setField("areaId", areaId)}
          onCurrentTotalChange={(value) => setField("currentTotal", value)}
          onUseReadTotal={() => {
            const total = readTotals?.finalTotal;
            if (total) setField("currentTotal", total);
          }}
          onContinue={handleWhereContinue}
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
          errors={{
            whatsappNumber: errors.whatsappNumber?.message,
            email: errors.email?.message,
          }}
          onSubmit={() => void handleSubmit()}
          onBack={() => goTo(STEP_WHERE)}
          onEditBasket={() => goTo(STEP_BASKET)}
          onEditArea={() => goTo(STEP_WHERE)}
          onContactTypeChange={(type) => {
            setField("contactType", type);
            clearErrors(["whatsappNumber", "email"]);
          }}
          onDialCodeChange={(code) => setField("dialCode", code)}
          onWhatsappNumberChange={(value) => setField("whatsappNumber", value)}
          onEmailChange={(value) => setField("email", value)}
          onMarketingConsentChange={(value) => setField("marketingConsent", value)}
        />
      ) : null}
    </WizardShell>
  );
}
