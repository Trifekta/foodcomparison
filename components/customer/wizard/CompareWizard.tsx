"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch, type PathValue } from "react-hook-form";
import type { PublicArea } from "@/types/database";
import type { StructuredBasket } from "@/lib/extraction/schema";
import {
  ERROR_MESSAGES,
  amountSchema,
  cartItemsSchema,
  submissionFieldsSchema,
} from "@/lib/validation/submission";
import { rememberLastOrder } from "@/lib/utils/last-order";
import { track, visitId } from "@/lib/analytics/track";
import { attributionFormFields, currentAttribution } from "@/lib/analytics/attribution";
import { compressForUpload } from "@/lib/images/compress";
import { itemTitle } from "@/lib/extraction/normalise";
import {
  clearWizardSession,
  consumeReturnFromApp,
  hasProgress,
  loadWizardSession,
  restoredStep,
  saveWizardSession,
} from "@/lib/customer/wizard-session";
import {
  restoreDraft,
  uploadDraftFile,
  saveDraft,
} from "@/lib/customer/draft-client";
import { WizardShell } from "./WizardShell";
import { StepUpload } from "./StepUpload";
import { StepConfirm } from "./StepConfirm";
import {
  WIZARD_DEFAULTS,
  cartConfirmedShort as isCartConfirmedShort,
  combineStatus,
  hasAnyTotal,
  mergeReadTotals,
  readTotalOffer,
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
const STEP_CONFIRM = 2;

/**
 * How long the send button will wait for the screenshot read before giving up
 * on it.
 *
 * The read has to finish for the confirm screen to be pre-filled, and on the
 * four-screen flow two screens of walking paid for that latency by accident.
 * With those screens gone the button has to hold the door instead - otherwise
 * a quick customer sends a blank restaurant and no items while the read is
 * still a second from landing.
 *
 * It is a deadline rather than a gate because the read can hang: the model
 * call has no timeout of its own, and a request that never settles would
 * otherwise leave the button disabled for good. The read is not cancelled when
 * this expires - if it lands later it still fills everything in. Only the
 * waiting stops.
 */
const READ_WAIT_MS = 20_000;

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
    reset,
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
  // Draft file paths from temporary storage, used if user doesn't upload new files
  const [draftPaths, setDraftPaths] = useState<{
    cart: string | null;
    checkout: string | null;
  }>({ cart: null, checkout: null });
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
  /**
   * The send button has waited long enough for the cart read.
   *
   * Reset by each new cart screenshot (in startRead, from a tap) and set by the
   * deadline below. Kept apart from the read's own status on purpose: a read
   * that is still running is still allowed to land and fill the form, whatever
   * this says. All this decides is whether the customer is made to wait for it.
   */
  const [readWaitExpired, setReadWaitExpired] = useState(false);
  /**
   * The total this filled in by itself, if any.
   *
   * State rather than a ref because two effects now touch it - the restore
   * seeds it, the autofill writes it - and because the save effect has to
   * re-run when it changes, or the memory never reaches sessionStorage.
   */
  const [autofilled, setAutofilled] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Guards against a double tap firing two submissions before state settles.
  const submitLock = useRef(false);
  // They tapped through to a food app and have come back. Drives the greeting
  // on the upload screen, and nothing else.
  const [returnedFromApp, setReturnedFromApp] = useState(false);
  // Whether that return brought anything back with it, which decides whether
  // the greeting claims it did.
  const [restoredProgress, setRestoredProgress] = useState(false);
  /**
   * Whether the restore below has finished.
   *
   * State, not a ref, and the distinction is the whole of a bug this had: a ref
   * set at the end of the restore effect is already true when the save effect
   * runs immediately after it in the same commit - but `values` and `items` in
   * that pass are still the pre-restore ones, because the setState calls have
   * not re-rendered yet. The save then wrote WIZARD_DEFAULTS straight over the
   * session it had just read, and everything the customer had typed before
   * leaving for a food app was gone by the time they came back.
   *
   * As state it flips on a later render, by which point the restored values are
   * the ones being saved.
   */
  const [restored, setRestored] = useState(false);

  /**
   * Picking up where a discarded tab left off.
   *
   * This flow sends people to another app on purpose, and a backgrounded tab on
   * a phone is routinely discarded and reloaded on return - so "come back here"
   * has to survive the page being rebuilt from nothing. What was typed comes
   * back; the screenshots cannot (see lib/customer/wizard-session.ts), which is
   * why restoredStep puts anyone who was further along back on the upload
   * screen rather than on a step that assumes an image exists.
   */
  useEffect(() => {
    // After mount, deliberately: sessionStorage does not exist while this
    // renders on the server, so the first paint has to be the empty wizard and
    // what was stored can only be applied once the browser has it. Same shape
    // as LastOrderBanner, and the rule is silenced for the same reason.
    /* eslint-disable react-hooks/set-state-in-effect -- see above */
    const saved = loadWizardSession();
    if (saved) {
      reset(saved.values);
      setItems(saved.items);
      // Before anything can read a screenshot, so the first read after a
      // restore knows whether the total already in the form is ours to
      // replace or theirs to leave alone.
      setAutofilled(saved.autofilled);
      setRestoredProgress(hasProgress(saved));
      // A reload is the only way this branch is reached, and no File survives
      // one - so the answer to "do they still have a screenshot" is always no.
      setStep(restoredStep(saved.step, false, STEP_UPLOAD));
    }
    if (consumeReturnFromApp()) {
      // The landing page has always recorded its own return; this one was
      // detected for the banner and never counted, so the round trip the whole
      // food-app detour exists to enable was invisible in the funnel. Same
      // event name as the landing page's, because it is the same fact.
      track("returned_from_app");
      setStep(STEP_UPLOAD);
      setReturnedFromApp(true);
    } else {
      // Only track wizard_started on the first visit to the upload screen, not
      // when returning from a food app (which is tracked as returned_from_app).
      // An advert can point straight here, and this screen is where campaign
      // parameters are captured - but this only fires once per page load, not
      // on every remount, so a return from the food app does not double-count.
      track("wizard_started");
    }
    // Restore draft from server if available. Runs after sessionStorage
    // restore so both local and server state are recovered. Async, so it
    // completes after sessionStorage restore has already written to the form.
    void (async () => {
      const draft = await restoreDraft();
      if (draft) {
        // Merge with defaults to handle schema changes or missing fields
        reset({ ...WIZARD_DEFAULTS, ...draft.state });
        setDraftPaths({
          cart: draft.cartImagePath,
          checkout: draft.checkoutImagePath,
        });
        // Restore step, but put them back on upload if they don't have files
        // (files don't serialize across page reloads)
        const restoredStepValue = restoredStep(draft.step, false, STEP_UPLOAD);
        setStep(restoredStepValue);
      }
    })();

    setRestored(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [reset]);

  /**
   * The same return, on a tab that was never discarded.
   *
   * The lucky case: React state is untouched, so there is nothing to restore
   * and the only work is putting them on the screen that wants their
   * screenshot. Armed exclusively by tapping a food-app link, so an ordinary
   * tab switch cannot pull somebody off the step they were working on.
   */
  useEffect(() => {
    const onVisible = () => {
      if (document.hidden || !consumeReturnFromApp()) return;
      // consumeReturnFromApp disarms the flag as it reads it, so this and the
      // restore path above cannot both fire for one departure.
      track("returned_from_app");
      setStep(STEP_UPLOAD);
      setReturnedFromApp(true);
      window.scrollTo({ top: 0 });
    };

    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  useEffect(() => {
    if (!restored) return;
    saveWizardSession({ step, values, items, autofilled });
  }, [restored, step, values, items, autofilled]);

  // Save draft to server when form state changes (debounced)
  useEffect(() => {
    if (!restored) return;

    // Don't save if we don't have a visit ID yet
    if (step === STEP_UPLOAD) {
      const timer = setTimeout(() => {
        void saveDraft({
          step,
          state: values,
          cartImagePath: draftPaths.cart,
          checkoutImagePath: draftPaths.checkout,
        });
      }, 2000); // Debounce form changes

      return () => clearTimeout(timer);
    }

    return undefined;
  }, [restored, step, values, draftPaths]);

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

  /**
   * Two figures, for two different jobs.
   *
   * `offer` is what goes in the field: the best number the screenshots printed,
   * which may be a settled bill or only the food. It exists so a customer whose
   * cart screen never showed a delivery fee is not left retyping a number they
   * have already sent us.
   *
   * `trustedTotal` stays settled-or-nothing, because it answers a different
   * question - may we tell this customer their fees were checked? A subtotal
   * can never answer yes to that, however useful it is in the field.
   */
  const offer = readTotalOffer(readTotals);
  const trustedTotal = trustedFinalTotal(readTotals);

  useEffect(() => {
    const decision = shouldAutofillTotal({
      readFinalTotal: offer.value,
      typed: getValues("currentTotal"),
      lastAutofilled: autofilled,
    });
    if (!decision) return;

    // Upgrades as well as fills. A subtotal put here from the cart screenshot
    // is still `lastAutofilled`, so adding the checkout screen later - which
    // settles the bill - is allowed to replace it. Anything the customer typed
    // themselves is not touched either time.
    setValue("currentTotal", offer.value);
    clearErrors("currentTotal");
    // Settles on the next pass rather than looping: the effect re-runs because
    // this changed, and shouldAutofillTotal then sees the figure it has
    // already filled and declines.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see above
    setAutofilled(offer.value);
  }, [offer.value, autofilled, getValues, setValue, clearErrors]);

  const setField = <K extends keyof WizardValues & string>(
    name: K,
    value: PathValue<WizardValues, K>,
  ) => {
    setValue(name, value);
    clearErrors(name);
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
    // A new screenshot earns a fresh wait. Cart only: the send button never
    // waits on the checkout slot, which fills nothing the submission requires.
    if (slot === "cart") setReadWaitExpired(false);

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
   * The funnel, now that three screens are one.
   *
   * The event names are unchanged - they are what every row already recorded
   * and every dashboard query calls these steps - but what fires them is no
   * longer "a screen opened". There is only one screen left to open, so each
   * rung is the act it was always labelled as, recorded once per visit:
   *
   *   step_basket  reaching the confirm screen
   *   step_where   choosing the delivery area
   *   step_review  having area, total and the Keeta question all answered
   *
   * Refs rather than state, because nothing renders from them and a customer
   * who edits a field twice is still one visit that reached that rung.
   */
  const trackedWhere = useRef(false);
  const trackedReview = useRef(false);

  useEffect(() => {
    if (step !== STEP_CONFIRM || !values.areaId) return;

    // The first event that can carry an area, which is what keeps the area
    // report alive: a visit's area is resolved from whichever of its events
    // has one, and every rung below this inherits it from here.
    if (!trackedWhere.current) {
      trackedWhere.current = true;
      track("step_where", undefined, values.areaId);
    }

    // Truthiness, not a comparison against "": the field's type is the pair of
    // answers it can end on, while its default - deliberately outside that type
    // - is blank (see WIZARD_DEFAULTS). Asking whether it equals "" is a
    // question TypeScript believes it already knows the answer to.
    if (!trackedReview.current && values.currentTotal !== "" && Boolean(values.newToKeeta)) {
      trackedReview.current = true;
      track("step_review", undefined, values.areaId);
    }
  }, [step, values.areaId, values.currentTotal, values.newToKeeta]);

  /** Stops waiting on a read that is taking too long. See READ_WAIT_MS. */
  useEffect(() => {
    if (cartStatus !== "reading") return;
    const timer = setTimeout(() => setReadWaitExpired(true), READ_WAIT_MS);
    return () => clearTimeout(timer);
  }, [cartStatus]);

  const goTo = (next: number) => {
    setStep(next);
    if (next === STEP_CONFIRM) track("step_basket", undefined, getValues("areaId"));
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  };

  /**
   * Puts the customer on the first thing that needs them.
   *
   * With every field on one screen, a failed submit can set four errors at
   * once and three of them can be off-screen - which is the one way merging
   * the steps could be made worse than leaving them apart. Found in the DOM
   * rather than tracked field by field: every field here already marks itself
   * invalid for screen readers, so the same marking can be read back.
   *
   * Two frames, because the errors have only just been set: the first lets
   * React commit them (which is also what opens the basket panel around a
   * restaurant error), the second runs once that commit is on screen.
   */
  const focusFirstInvalid = () => {
    if (typeof window === "undefined") return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const target = document.querySelector<HTMLElement>(
          '[aria-invalid="true"], [data-invalid="true"]',
        );
        if (!target) return;
        target.scrollIntoView({ behavior: "smooth", block: "center" });
        target.focus({ preventScroll: true });
      });
    });
  };

  const handleUploadContinue = () => {
    if (!files.cart) {
      setCartError(ERROR_MESSAGES.cartMissing);
      return;
    }
    setCartError(null);

    // The total is not required to leave this screen - it is asked for again,
    // and properly, on the next one. But a number typed here that could never
    // be valid is worth saying so about now, while they are still looking at
    // the field, rather than after a screen transition.
    const typed = getValues("currentTotal");
    if (typed.trim() !== "") {
      const parsed = amountSchema.safeParse(typed);
      if (!parsed.success) {
        setError("currentTotal", {
          type: "manual",
          message: parsed.error.issues[0]?.message ?? ERROR_MESSAGES.invalidTotal,
        });
        return;
      }
    }
    clearErrors("currentTotal");

    goTo(STEP_CONFIRM);
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
      // Everything this can complain about is on the screen they are already
      // looking at, so there is nowhere to send them - only something to point
      // at, which may well be below the fold.
      focusFirstInvalid();
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
      // Include draft paths so server can use existing files if no new ones uploaded
      if (draftPaths.cart) body.append("draftCartImagePath", draftPaths.cart);
      if (draftPaths.checkout) body.append("draftCheckoutImagePath", draftPaths.checkout);
      // Include visit ID for draft linkage
      const vid = visitId();
      if (vid) body.append("visitId", vid);
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

      // The order is in. Anything still held for a half-finished wizard would
      // only reopen it behind them if they came back to /compare later.
      clearWizardSession();

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

  return (
    <WizardShell step={step} onBack={step === STEP_UPLOAD ? null : () => goTo(step - 1)}>
      {step === STEP_UPLOAD ? (
        <StepUpload
          cartFile={files.cart}
          checkoutFile={files.checkout}
          cartReading={cartReading}
          cartSettlesTheBill={cartSettled}
          cartConfirmedShort={cartIsConfirmedShort}
          returnedFromApp={returnedFromApp}
          restoredProgress={restoredProgress}
          onCartChange={(file: File | null) => {
            setFiles((current) => ({ ...current, cart: file }));
            setCartError(null);
            if (!file) clearRead("cart");
          }}
          onCheckoutChange={(file: File | null) => {
            setFiles((current) => ({ ...current, checkout: file }));
            if (!file) clearRead("checkout");
          }}
          // Fired the instant a file is picked, ahead of the display copy's
          // downscale - see onFilePicked on ImageUpload. Reads the original,
          // not the compressed upload: JPEG artifacts on small text cost far
          // more accuracy than the extra pixels cost time, and that copy is
          // not even ready yet at this point.
          onCartPicked={(file) => {
            // The greeting has done its job the moment they act on it.
            setReturnedFromApp(false);
            // Upload to temporary draft storage and save draft state
            void (async () => {
              const upload = await uploadDraftFile(file, "cart");
              if ("path" in upload) {
                setDraftPaths((current) => ({ ...current, cart: upload.path }));
                await saveDraft({
                  step: STEP_UPLOAD,
                  state: getValues(),
                  cartImagePath: upload.path,
                  checkoutImagePath: draftPaths.checkout,
                });
              }
            })();
            startRead(file, "cart");
          }}
          onCheckoutPicked={(file) => {
            // Upload to temporary draft storage
            void (async () => {
              const upload = await uploadDraftFile(file, "checkout");
              if ("path" in upload) {
                setDraftPaths((current) => ({ ...current, checkout: upload.path }));
                await saveDraft({
                  step,
                  state: getValues(),
                  cartImagePath: draftPaths.cart,
                  checkoutImagePath: upload.path,
                });
              }
            })();
            startRead(file, "checkout");
          }}
          manualTotal={values.currentTotal}
          totalKind={offer.kind}
          checkoutStatus={checkoutStatus}
          prefilledFromScreenshot={offer.value !== "" && values.currentTotal === offer.value}
          onManualTotalChange={(value) => setField("currentTotal", value)}
          totalError={errors.currentTotal?.message}
          error={cartError}
          onContinue={handleUploadContinue}
        />
      ) : null}

      {step === STEP_CONFIRM ? (
        <StepConfirm
          values={values}
          files={files}
          items={items}
          areas={areas}
          extractionStatus={extractionStatus}
          readTotals={readTotals}
          totalsFromCheckout={totalsFromCheckout}
          // The hint and its button offer whatever the screenshots printed,
          // settled or not - and `totalKind` travels with it so the screen can
          // name the figure honestly rather than implying every number here is
          // a final bill.
          readTotal={offer.value || null}
          totalKind={offer.kind}
          totalFromCheckout={totalsFromCheckout && checkoutTotals.finalTotal !== ""}
          prefilledFromScreenshot={offer.value !== "" && values.currentTotal === offer.value}
          waitingOnRead={cartReading && !readWaitExpired}
          submitting={submitting}
          submitError={submitError}
          errors={{
            restaurantName: errors.restaurantName?.message,
            areaId: errors.areaId?.message,
            currentTotal: errors.currentTotal?.message,
            newToKeeta: errors.newToKeeta?.message,
            whatsappNumber: errors.whatsappNumber?.message,
          }}
          onRestaurantNameChange={(value) => setField("restaurantName", value)}
          onItemsChange={setItems}
          onAreaChange={(areaId) => setField("areaId", areaId)}
          onCurrentTotalChange={(value) => setField("currentTotal", value)}
          onNewToKeetaChange={(value) => setField("newToKeeta", value)}
          onUseReadTotal={() => {
            if (offer.value) setField("currentTotal", offer.value);
          }}
          onDialCodeChange={(code) => setField("dialCode", code)}
          onWhatsappNumberChange={(value) => setField("whatsappNumber", value)}
          onMarketingConsentChange={(value) => setField("marketingConsent", value)}
          onSubmit={() => void handleSubmit()}
        />
      ) : null}
    </WizardShell>
  );
}
