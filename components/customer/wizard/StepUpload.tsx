"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { StepActions } from "./StepActions";
import { ImageUpload } from "@/components/forms/ImageUpload";
import { AmountInput } from "@/components/forms/AmountInput";
import { FoodPhoto } from "@/components/customer/FoodPhoto";
import { ScriptBubble, ScriptNote, Sparks } from "@/components/customer/Motifs";
import { Camera, Smartphone } from "lucide-react";
import { LastOrderBanner } from "@/components/customer/LastOrderBanner";
import { ScrollDepth } from "@/components/customer/ScrollDepth";
import { FoodAppLinks } from "./FoodAppLinks";
import { track } from "@/lib/analytics/track";
import { captureAttribution } from "@/lib/analytics/attribution";
import { RESULT_PROMISE } from "@/lib/constants";
import type { ExtractionStatus, TotalKind } from "./types";

interface StepUploadProps {
  cartFile: File | null;
  checkoutFile: File | null;
  /** The first screenshot is still being read, so we cannot say yet. */
  cartReading: boolean;
  /** It carried a printed final total beside its fees - nothing else is needed. */
  cartSettlesTheBill: boolean;
  /** It was read in full and came back without one - now we know, not guess. */
  cartConfirmedShort: boolean;
  /**
   * They tapped one of the food-app links and have just come back. Set only by
   * that round trip - never by an ordinary tab switch - so the greeting below
   * only ever appears for somebody it is actually true of.
   */
  returnedFromApp: boolean;
  /**
   * That return brought typed fields back with it. False for the visit this
   * flow is built around - an advert click who leaves from an empty step one -
   * where there was nothing to keep and saying otherwise is noise.
   */
  restoredProgress: boolean;
  /** `original` is the untouched file, before it was compressed for upload. */
  onCartChange: (file: File | null, original?: File | null) => void;
  onCheckoutChange: (file: File | null, original?: File | null) => void;
  /**
   * Fires the instant a file is chosen, ahead of onCartChange/onCheckoutChange
   * - which wait on the display copy to finish downscaling. The read wants the
   * original bytes anyway, so starting it here rather than there is most of
   * where "the emphasis feels slow" actually goes.
   */
  onCartPicked: (file: File) => void;
  onCheckoutPicked: (file: File) => void;
  /**
   * The final payable amount, typed here rather than photographed.
   *
   * The same react-hook-form field the confirm step edits, which is the whole
   * reason this can live on two screens at once for free - and why a number
   * typed here is still there, and still changeable, one screen later.
   */
  manualTotal: string;
  /** What the read offered, so this card never calls a subtotal a final total. */
  totalKind: TotalKind;
  /**
   * How the SECOND screenshot's own read is going.
   *
   * Everything else on this slot is decided by what the CART read found, which
   * is the right answer to "should we ask for a checkout screen" and the wrong
   * answer to "what happened to the one you just gave us". Without this the
   * slot goes on asking for a file it is already holding.
   */
  checkoutStatus: ExtractionStatus;
  /** The field holds a figure we read, rather than one they typed. */
  prefilledFromScreenshot: boolean;
  onManualTotalChange: (value: string) => void;
  /** Only ever a format complaint: this field is optional on this screen. */
  totalError?: string;
  error: string | null;
  onContinue: () => void;
}

/**
 * One screenshot, and a second one only where the app needs it.
 *
 * Which is not a thing this screen can know in advance. Talabat, noon and Keeta
 * print the payment summary under the items on the cart page - discount,
 * delivery, service fee and the final total, all on the screen somebody is
 * already looking at - so one screenshot from any of those three settles the
 * bill completely. Deliveroo puts the money on a separate screen. Asking
 * everybody for two up front taxes the majority for the minority; asking for
 * one and comparing against an item subtotal is the worse mistake in the other
 * direction.
 *
 * So the second slot moves in two ways, but only one of them touches what it
 * says. It starts Recommended, because until the first screenshot has been
 * read the odds are simply unknown. The moment that read comes back carrying a
 * total and its fees, the slot drops to Optional and says so: nothing further
 * is needed, and continuing to press for a screen they have already
 * effectively sent is how a person decides this is too much work.
 *
 * But if that same read comes back and the total is not on it - an item list
 * with no payment summary under it, the Deliveroo shape - the slot stays
 * exactly Recommended in what it says, and gets visually louder in how it
 * says it: a ring, a small pulse. Not a fourth tier next to Required, because
 * it still is not required - nothing here has ever gated Continue, and a
 * stronger badge would claim otherwise. The pill's job is to state the rule;
 * the emphasis's job is only to earn a second look once we know, rather than
 * guess, that this slot is what completes the comparison.
 *
 * Each slot carries an (i) to a drawing of a good screenshot. Behind an icon
 * rather than on the page: this is where somebody weighs the wait against the
 * effort of finding a screenshot, and a screen that lectures them there costs
 * more uploads than a bad screenshot does.
 */
export function StepUpload({
  cartFile,
  checkoutFile,
  cartReading,
  cartSettlesTheBill,
  cartConfirmedShort,
  returnedFromApp,
  restoredProgress,
  onCartChange,
  onCheckoutChange,
  onCartPicked,
  onCheckoutPicked,
  manualTotal,
  totalKind,
  checkoutStatus,
  prefilledFromScreenshot,
  onManualTotalChange,
  totalError,
  error,
  onContinue,
}: StepUploadProps) {
  // Whether a new cart screenshot has been picked on this visit. Local, not
  // read from cartFile: cartFile only updates once the display copy finishes
  // downscaling, and a slow phone on a big screenshot is exactly the case the
  // read's own latency fix (onFilePicked, ahead of that same downscale) exists
  // for. The banner should disappear on the same signal, not lag behind it.
  const [uploadStarted, setUploadStarted] = useState(false);
  const [forkChoice, setForkChoice] = useState<"none" | "upload" | "app">(
    returnedFromApp ? "upload" : "none",
  );

  // The field is holding what we read, and what we read was the food without
  // its fees. Only while that number is still the one in the field - the
  // moment they type over it, it is their figure and not our reading.
  // What the field is holding, and only while it is still OUR figure - the
  // moment they type over it, it is theirs and neither of these is true.
  const subtotalOnly = prefilledFromScreenshot && totalKind === "subtotal";
  const settledFill = prefilledFromScreenshot && totalKind === "settled";

  // Asked and answered. Which screenshot settled the bill does not matter here;
  // that the customer has already given us one does.
  const checkoutAnswered = checkoutFile !== null && checkoutStatus !== "reading";

  /**
   * Whether this card is still offering a way out, or holding a figure.
   *
   * It is a question - "Don't have a checkout screenshot?" - only while nobody
   * has given us one and nothing has been read. Every other state names the
   * number it is holding, and then the field below must NOT repeat that name:
   * the heading has said it, one line up.
   */
  const askingForOne =
    !cartSettlesTheBill && !settledFill && !subtotalOnly && checkoutFile === null;
  const fieldLabel = subtotalOnly ? "Your order subtotal" : "Your final total";

  // Start fetching the reading engine now, while they are in their gallery
  // choosing a photo. Waiting until they have chosen puts several megabytes
  // directly in front of the screen meant to impress them.
  useEffect(() => {
    let cancelled = false;
    void import("@/lib/ocr/browser").then(({ warmOcr }) => {
      if (!cancelled) warmOcr("customer");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Attribution is captured every time we return to the upload screen, but it
  // is a no-op if already captured by the landing page or on a previous visit.
  // The wizard_started event itself is now tracked in CompareWizard on the first
  // visit only, so it does not fire again if returning from a food app.
  useEffect(() => {
    captureAttribution();
  }, []);

  return (
    <>
      {/* Mounted on this step alone, so its reading means "how far down the
          upload screen", not "how far down whichever step they were on". It
          sends when this unmounts, which is what advancing past it looks
          like. */}
      <ScrollDepth />

      {/* Hero banner. The spread bleeds past the top edge, as in the reference.

          Hidden below 390px, where it is the difference between seeing the
          upload button on arrival and having to scroll for it. It restates the
          landing page's promise to somebody who has already accepted it and is
          here to act on it - 150px of reassurance charged to the one control
          this screen exists for. On a roomier phone it costs nothing and
          stays. */}
      <div className="relative rounded-3xl bg-linear-to-r from-brand-100 to-beige px-4 py-4 max-[389px]:hidden">
        <div className="relative z-10 max-w-[44%]">
          <ScriptNote underline className="text-[1.35rem] text-ink-900">
            Same Food
            <br />
            Lower Prices
          </ScriptNote>
          <p className="mt-2 text-[0.82rem] font-semibold leading-snug text-slate-600">
            Upload. Compare.
            <br />
            Save more.
          </p>
        </div>
        <FoodPhoto
          name="spread"
          eager
          className="pointer-events-none absolute right-0 top-1/2 w-[62%] -translate-y-1/2 select-none"
        />
        <ScriptBubble className="absolute -right-1 -top-2 z-10 text-[0.64rem] leading-tight">
          Good
          <br />
          Deals Ahead <span aria-hidden="true">&hearts;</span>
        </ScriptBubble>
      </div>

      {/* Back from a food app, screenshot in hand. Stays put until they pick
          one rather than fading on a timer: it is not a notification, it is
          the answer to "am I in the right place and did I lose anything". */}
      {returnedFromApp && !uploadStarted ? (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="text-[0.95rem] font-bold text-emerald-900">
            Welcome back — upload your screenshot
          </p>
          {restoredProgress ? (
            <p className="mt-0.5 text-[0.82rem] leading-snug text-emerald-800">
              Everything you had entered is still here.
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Above everything, because somebody who already has an order in flight
          is not here to start another one - until they pick a screenshot,
          which says the opposite: whatever this banner is offering to resume,
          they have just demonstrated they are not resuming it. Suppressed on
          the way back from a food app: that round trip is a statement of intent
          about this order, so offering to reopen an older one is noise. */}
      {uploadStarted || returnedFromApp ? null : <LastOrderBanner />}

      <h1 className="relative mt-4 inline-flex items-start text-[1.9rem] font-extrabold leading-tight text-ink-900">
        Upload your order
        <Sparks className="ml-1 h-5 w-5 shrink-0" />
      </h1>
      <p className="mt-1.5 text-[0.95rem] leading-relaxed text-slate-600">
        {cartSettlesTheBill
          ? "Your screenshot shows the total already — you're set. Add the checkout screen only if you want to."
          : cartConfirmedShort
            ? "Your cart screenshot doesn't show a total — add the checkout screen below for an exact comparison."
            : (
                // Bold on purpose: a real customer uploaded a screenshot of Keeta
                // itself, believing that was the point - nothing before this line
                // ever named the app being compared against, so the one sentence
                // that fixes that needs to be impossible to skim past.
                <strong className="font-bold text-ink-900">
                  Upload your cart from Talabat, Careem, Deliveroo, or Noon Food — we&apos;ll
                  check if it&apos;s cheaper on Keeta.
                </strong>
              )}
      </p>

      {/* Repeated from the landing page on purpose. This is the screen where
          somebody weighs the wait against the effort of finding a screenshot,
          and the answer to "how long will this take" belongs next to that
          decision, not one screen behind it. */}
      <p className="mt-2.5 inline-block rounded-full bg-brand-100 px-3.5 py-1.5 text-[0.85rem] font-bold text-ink-800">
        Your result, usually {RESULT_PROMISE}
      </p>

      {/* Two-path fork for visitors without a screenshot. Once a cart file
          exists the fork disappears and the full upload flow takes over. */}
      {!cartFile && (
        <div className="mt-5">
          <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
            <button
              type="button"
              // Recorded only when the answer changes, so tapping the same
              // card twice is one answer rather than two - /api/events is
              // capped per IP and that cap is shared across a venue's wifi.
              onClick={() => {
                if (forkChoice !== "upload") track("fork_have_screenshot");
                setForkChoice("upload");
              }}
              className={`rounded-2xl border-2 p-4 text-left transition-colors ${
                forkChoice === "upload"
                  ? "border-brand-500 bg-brand-50"
                  : "border-ink-200 bg-white hover:border-brand-300"
              }`}
            >
              <Camera aria-hidden="true" className="h-6 w-6 text-brand-600" />
              <h2 className="mt-2 text-[1rem] font-extrabold text-ink-900">
                Have a screenshot?
              </h2>
              <p className="mt-1 text-[0.85rem] leading-snug text-slate-600">
                Upload it now
              </p>
            </button>

            <button
              type="button"
              onClick={() => {
                if (forkChoice !== "app") track("fork_need_to_take");
                setForkChoice("app");
              }}
              className={`rounded-2xl border-2 p-4 text-left transition-colors ${
                forkChoice === "app"
                  ? "border-brand-500 bg-brand-50"
                  : "border-ink-200 bg-white hover:border-brand-300"
              }`}
            >
              <Smartphone aria-hidden="true" className="h-6 w-6 text-brand-600" />
              <h2 className="mt-2 text-[1rem] font-extrabold text-ink-900">
                Need to take one?
              </h2>
              <p className="mt-1 text-[0.85rem] leading-snug text-slate-600">
                Choose your food app
              </p>
            </button>
          </div>

          {forkChoice === "upload" && (
            <div className="mt-3">
              <ImageUpload
                step={1}
                label="Cart screenshot"
                hint="Restaurant and selected items"
                helper="Make sure your restaurant name and ordered items are visible."
                requirement="required"
                art="cartDoc"
                example="cart"
                file={cartFile}
                onChange={onCartChange}
                onFilePicked={(file) => {
                  setUploadStarted(true);
                  track("cart_uploaded");
                  onCartPicked(file);
                }}
                error={error}
              />
            </div>
          )}

          {forkChoice === "app" && (
            <div className="mt-3 space-y-3">
              <p className="text-[0.88rem] leading-snug text-slate-600">
                No Keeta screenshot needed — we check Keeta for you.
              </p>
              <FoodAppLinks />
            </div>
          )}
        </div>
      )}

      {/* Full upload flow once a cart screenshot exists. */}
      {cartFile && (
        <div className="mt-4 space-y-3">
          <ImageUpload
            step={1}
            label="Cart screenshot"
            hint="Restaurant and selected items"
            helper="Make sure your restaurant name and ordered items are visible."
            requirement="required"
            art="cartDoc"
            example="cart"
            file={cartFile}
            onChange={onCartChange}
            onFilePicked={(file) => {
              setUploadStarted(true);
              track("cart_uploaded");
              onCartPicked(file);
            }}
            error={error}
          />

          <ImageUpload
            step={2}
            label="Checkout total"
            hint={
              checkoutFile
                ? checkoutStatus === "reading"
                  ? "Reading this screenshot…"
                  : checkoutStatus === "applied"
                    ? "We read your total from this one"
                    : "No total found on this one"
                : cartSettlesTheBill
                  ? "Already covered by your first screenshot"
                  : cartConfirmedShort
                    ? "Your total wasn't on the first screenshot"
                    : "Fees, discounts and final total"
            }
            helper={
              checkoutAnswered
                ? checkoutStatus === "applied"
                  ? "Got it — your total below now comes from this screenshot."
                  : "We couldn't find a total on this one. Check nothing got cut off, or type your total below."
                : checkoutFile
                  ? "Reading it now — your total will fill in below."
                  : cartSettlesTheBill
                    ? "Your first screenshot already showed the fees and total, so you can skip this."
                    : cartConfirmedShort
                      ? "We read your cart screenshot but didn't find a total on it — add this one so we compare the right number."
                      : cartReading
                        ? "Checking your first screenshot — add this if your total is on a different screen."
                        : "From the same app as your cart — this shows your discounts, fees and final total."
            }
            requirement={cartSettlesTheBill ? "optional" : "recommended"}
            emphasize={cartConfirmedShort && checkoutFile === null}
            art="receipt"
            example="checkout"
            allowRemove
            file={checkoutFile}
            onChange={onCheckoutChange}
            onFilePicked={(file) => {
              setUploadStarted(true);
              track("checkout_uploaded");
              onCheckoutPicked(file);
            }}
          />

          <div className="relative py-0.5">
            <span aria-hidden="true" className="absolute inset-x-0 top-1/2 h-px bg-ink-200" />
            <span className="relative mx-auto block w-12 bg-canvas text-center text-[0.78rem] font-bold uppercase tracking-wide text-slate-500">
              or
            </span>
          </div>

          <div className="rounded-3xl bg-cream p-3.5 ring-1 ring-sand">
            <h3 className="text-[1rem] font-extrabold text-ink-900">
              {askingForOne ? "Don't have a checkout screenshot?" : fieldLabel}
            </h3>
            <p className="mt-0.5 mb-3 text-[0.88rem] leading-snug text-slate-600">
              {cartSettlesTheBill
                ? "This is what we read off your cart screenshot — after discounts, fees and delivery."
                : settledFill
                  ? "This is what we read off your screenshots — after discounts, fees and delivery."
                  : subtotalOnly
                    ? "We read this off your cart screenshot. It's the food only — the screen didn't show delivery or service fees."
                    : checkoutFile
                      ? "We couldn't read a total off your screenshots — type the final payable amount here."
                      : "Enter your final payable amount instead — after discounts, fees and delivery."}
            </p>
            <AmountInput
              label={fieldLabel}
              hideLabel={!askingForOne}
              value={manualTotal}
              onChange={(event) => onManualTotalChange(event.target.value)}
              error={totalError}
            />
            <p className="mt-3 text-[0.82rem] leading-snug text-slate-500">
              {cartSettlesTheBill || settledFill
                ? "Change it only if it looks wrong."
                : subtotalOnly
                  ? "Add the checkout screenshot above and we'll read your real total — or type it here yourself."
                  : checkoutFile
                    ? "You can change this on the next screen."
                    : "A checkout screenshot gives the most accurate comparison, but either one works. You can change this on the next screen."}
            </p>
          </div>
        </div>
      )}

      <StepActions>
        <Button onClick={onContinue} disabled={!cartFile} arrow>
          Continue
        </Button>
        {!cartFile ? (
          <p className="mt-2.5 text-center text-sm text-slate-500">
            Add your cart screenshot to continue.
          </p>
        ) : null}
      </StepActions>

      {/* The way back to an order this browser did not send - a different
          phone, or one that cleared its storage. It used to sit above the
          headline, where it was a third path competing for the attention of
          somebody who did not yet know what this page was; LastOrderBanner
          still takes the top slot when there IS an order to resume, which is
          the one case worth interrupting for. */}
      <p className="mt-4 text-center text-[0.85rem] text-slate-500">
        Sent us an order already?{" "}
        <Link
          href="/find"
          className="inline-flex min-h-11 items-center px-1.5 font-bold text-ink-800 underline underline-offset-2"
        >
          Find it with your reference
        </Link>
      </p>
    </>
  );
}
