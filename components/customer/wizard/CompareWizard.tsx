"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch, type PathValue } from "react-hook-form";
import type { z } from "zod";
import type { PublicArea } from "@/types/database";
import type { StructuredBasket } from "@/lib/extraction/schema";
import {
  ERROR_MESSAGES,
  basketStepSchema,
  cartItemsSchema,
  submissionFieldsSchema,
  whereStepSchema,
} from "@/lib/validation/submission";
import { rememberLastOrder } from "@/lib/utils/last-order";
import { track } from "@/lib/analytics/track";
import { attributionFormFields, currentAttribution } from "@/lib/analytics/attribution";
import { compressForUpload } from "@/lib/images/compress";
import { itemTitle } from "@/lib/extraction/normalise";
import type { FunnelEvent } from "@/lib/analytics/funnel";
import { WizardShell } from "./WizardShell";
import { StepUpload } from "./StepUpload";
import { StepBasket } from "./StepBasket";
import { StepWhereAndTotal } from "./StepWhereAndTotal";
import { StepReview } from "./StepReview";
import {
  WIZARD_DEFAULTS,
  cartConfirmedShort as isCartConfirmedShort,
  combineStatus,
  hasAnyTotal,
  mergeReadTotals,
  shouldAutofillTotal,
  totalsAreSettled,
  trustedFinalTotal,
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
/**
 * Reading one screenshot, by whichever route can actually read it.
 *
 * The model first. It sees the picture, so it gets the things Tesseract cannot:
 * a struck-through price beside the real one, a discount line, a currency glyph
 * welded to a digit. On the one real payment summary measured here, the browser
 * read the 2.70 service fee as 52.70 and lost a 16.20 discount; the model reads
 * the same screen correctly.
 *
 * Then the browser, for everything that stops the first one working - no key
 * configured, the rate limit reached, the network gone, the API having a bad
 * minute. That path is the one this app shipped with and it is still here in
 * full, so a customer never sees a dead form because a third party is down.
 *
 * Null means neither could make anything of it, which is the same outcome the
 * wizard has always had for an unreadable screenshot: the confirm step opens
 * empty and the customer types what they see.
 */
async function readBasket(file: File): Promise<StructuredBasket | null> {
  try {
    const body = new FormData();
    body.append("image", file);

    const response = await fetch("/api/extract", { method: "POST", body });

    if (response.ok) {
      const payload = (await response.json()) as { basket?: StructuredBasket };
      if (payload.basket) return payload.basket;
    }
  } catch {
    // Offline, blocked, or the request died in flight. Fall through and read it
    // here instead - a failed model call must never cost somebody their upload.
  }

  const [{ readImageInBrowser }, { parseOcrText }] = await Promise.all([
    import("@/lib/ocr/browser"),
    import("@/lib/extraction/parse-text"),
  ]);

  const ocr = await readImageInBrowser(file);
  if (!ocr.ok) return null;

  const { basket, empty } = parseOcrText(ocr.text);
  return empty ? null : basket;
}

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

  // Whether a bill is settled (trustedFinalTotal, below, is where this
  // actually gets used) is asked of the merged read, not of one slot. This
  // used to be asked of the checkout slot alone, on the belief that a cart
  // screen never carries a final total - and on Talabat, noon and Keeta it
  // plainly does: the payment summary sits under the items on the same
  // screen, discount, delivery, service fee and total together. Deliveroo is
  // the app that splits it in two. Believing the slot rather than the
  // reading charged three apps' customers for the fourth one's layout.
  const cartSettled = totalsAreSettled(cartTotals);
  const cartReading = cartStatus === "reading";

  // The cart screenshot has been read, in full, and it did not settle the
  // bill - so the second slot is not a hedge against an app we have not
  // identified anymore. We now know which kind of app this is. See
  // cartConfirmedShort in types.ts for the rule itself.
  const cartIsConfirmedShort = isCartConfirmedShort({
    hasCartFile: files.cart !== null,
    cartReading,
    cartSettled,
  });

  /**
   * The total, filled in from a screenshot rather than asked for again.
   *
   * From whichever screenshot printed one, with the checkout screen preferred
   * where both did - mergeReadTotals already resolves that, field by field.
   * What earns the fill is that a total was printed at all: the extraction
   * prompt forbids deriving or adding one up, so a value here was on the screen
   * rather than computed out of an item list. The old rule - checkout slot or
   * nothing - met a Talabat screenshot showing "Total amount 45.90" and asked
   * the customer to type 45.90.
   *
   * Filled, not locked. The field stays editable, because a read that is right
   * on one payment summary is not right on every one, and the person holding
   * the phone can see the screen we are guessing at.
   *
   * Gated on settled, not merely on final_total being non-empty. A Keeta
   * basket page can print "Order total AED 71.95" in exactly the type a real
   * payment summary uses, and the extraction has no way to know that number
   * excludes a delivery fee still to be added at checkout - only that nothing
   * beside it looked like a fee or a discount. Filling the field from that
   * number anyway is the mistake the block above is written against: it
   * would quietly present an incomplete figure as "what you paid" in the one
   * field this entire product measures a saving against, in the same breath
   * the upload screen is telling the customer this slot still needs a look.
   */
  const autofilled = useRef<string | null>(null);
  const trustedTotal = trustedFinalTotal(readTotals);

  useEffect(() => {
    const decision = shouldAutofillTotal({
      readFinalTotal: trustedTotal,
      typed: getValues("currentTotal"),
      lastAutofilled: autofilled.current,
    });
    if (!decision) return;

    setValue("currentTotal", trustedTotal);
    clearErrors("currentTotal");
    autofilled.current = trustedTotal;
  }, [trustedTotal, getValues, setValue, clearErrors]);

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
        const basket = await readBasket(file);
        if (!stillCurrent()) return;

        if (!basket) {
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
          return basket.items.map((item, index) => {
            // The title, not the title plus its whole description.
            //
            // A combo's modifier list runs to nine items - "Meal, Margherita,
            // Margherita, Margherita, Limo Combo, Pepsi (2.25 litres)..." - and
            // joined onto the name it filled the row, got cut off mid-word, and
            // left the customer confirming a basket they could not read. They
            // are being asked "is this your order", and "Limo Combo" answers
            // that; the rest is what is inside it, which they already know.
            //
            // Nothing is lost: the screenshot itself goes to the admin, who
            // rebuilds the basket from the picture rather than from this list.
            const name = itemTitle(item.name);

            return {
              key: crypto.randomUUID(),
              name,
              quantity: item.quantity,
              linePrice: item.line_total || null,
              priceUncertain: flagged.has(`items[${index}].line_total`) && item.line_total !== "",
              proposed: { name, quantity: item.quantity, linePrice: item.line_total || null },
            };
          });
        });

        setStatus(slot, applied ? "applied" : "empty");
      } catch {
        if (stillCurrent()) setStatus(slot, "empty");
      }
    })();
  };

  /**
   * Which step is which, for counting.
   *
   * Recorded on arrival rather than on the tap that caused it, so a customer
   * who goes back and comes forward again is not counted as having got further
   * than they did - the dashboard counts distinct visits per step, and this
   * only has to name the step honestly.
   */
  const STEP_EVENTS: Record<number, FunnelEvent> = {
    [STEP_BASKET]: "step_basket",
    [STEP_WHERE]: "step_where",
    [STEP_REVIEW]: "step_review",
  };

  const goTo = (next: number) => {
    setStep(next);
    const event = STEP_EVENTS[next];
    // The area rides along from the moment it is known - which is leaving the
    // area step, not arriving at it. Sent on every later step as well as the
    // first, so a visit that stops at review is still attributable: the report
    // resolves a visit's area from whichever of its events carries one.
    if (event) track(event, undefined, getValues("areaId"));
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
      // Shrunk before sending. The screenshots are almost all of the payload -
      // everything else is a few small fields - and on mobile data the upload is
      // the whole of the wait somebody feels after pressing the button. Both are
      // done together, and either falling back to the original costs nothing but
      // the saving.
      const [cartImage, checkoutImage] = await Promise.all([
        compressForUpload(files.cart),
        files.checkout ? compressForUpload(files.checkout) : Promise.resolve(null),
      ]);

      const body = new FormData();
      body.append("cartImage", cartImage);
      if (checkoutImage) body.append("checkoutImage", checkoutImage);
      for (const [key, value] of Object.entries(parsed.data)) {
        body.append(key, typeof value === "boolean" ? String(value) : value);
      }

      // Whether the screenshots settled the bill, which decides whether the
      // result carries the caveat about unchecked fees. Two conditions: a
      // payment summary was read at all, and the number we are comparing
      // against is still the one it printed. Retyped by hand and it is a figure
      // we did not verify again, whatever the screenshot said - which is the
      // whole of what the caveat claims.
      //
      // Asserted by the browser, like the per-row source labels. It buys
      // nobody anything to forge: the only thing it can do is hide a sentence
      // on the forger's own result page.
      body.append(
        "totalsConfirmed",
        String(trustedTotal !== "" && trustedTotal === parsed.data.currentTotal),
      );

      // Where this customer came from, captured when they arrived and carried
      // here so it can be stored on the submission. Everything downstream - the
      // result, the switch to Keeta - inherits it from the row rather than
      // trying to read a query string that stopped existing several screens ago.
      for (const [key, value] of Object.entries(attributionFormFields(currentAttribution()))) {
        body.append(key, value);
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
        // A JSON error is the server explaining itself, and it is always the
        // better message. Without one the reply came from something in front of
        // the app - a platform error page, a gateway timeout - which is worth
        // saying differently: "we couldn't reach the server" would be wrong when
        // the server answered, just not in a language we speak.
        if (!payload?.error) {
          console.error("[submissions] no JSON error in a failed response", {
            status: response.status,
            contentType: response.headers.get("content-type"),
          });
        }

        setSubmitError(payload?.error ?? ERROR_MESSAGES.serverError);
        return;
      }

      // Kept on this device so coming back to the site finds the order without
      // anybody typing a reference.
      if (payload.referenceNumber) {
        rememberLastOrder(payload.referenceNumber, payload.resultPath);
      }
      track("submitted", undefined, parsed.data.areaId);

      // Straight to their own result page, which starts out saying we are
      // checking and turns into the answer without them doing anything.
      router.replace(payload.resultPath);
      return;
    } catch (error) {
      // fetch itself threw: the request never completed. On a phone this is
      // usually the connection rather than us, which is what the message says.
      console.error("[submissions] the request did not complete", error);
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
          cartReading={cartReading}
          cartSettlesTheBill={cartSettled}
          cartConfirmedShort={cartIsConfirmedShort}
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
          // Both the hint chip and its "Use this" button offer a figure as
          // something to trust, same as the silent autofill above - so both
          // read from trustedTotal, not from whatever final_total happened to
          // hold. An unsettled total stays visible on the basket-confirm step
          // (StepBasket, further up, shows every field exactly as read), just
          // never offered here as an answer.
          readTotal={trustedTotal || null}
          totalFromCheckout={totalsFromCheckout && checkoutTotals.finalTotal !== ""}
          prefilledFromScreenshot={trustedTotal !== "" && values.currentTotal === trustedTotal}
          onAreaChange={(areaId) => setField("areaId", areaId)}
          onCurrentTotalChange={(value) => setField("currentTotal", value)}
          onUseReadTotal={() => {
            if (trustedTotal) setField("currentTotal", trustedTotal);
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
          errors={{ whatsappNumber: errors.whatsappNumber?.message }}
          onSubmit={() => void handleSubmit()}
          onBack={() => goTo(STEP_WHERE)}
          onEditBasket={() => goTo(STEP_BASKET)}
          onEditArea={() => goTo(STEP_WHERE)}
          onDialCodeChange={(code) => setField("dialCode", code)}
          onWhatsappNumberChange={(value) => setField("whatsappNumber", value)}
          onMarketingConsentChange={(value) => setField("marketingConsent", value)}
        />
      ) : null}
    </WizardShell>
  );
}
