"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { StepActions } from "./StepActions";
import { ImageUpload } from "@/components/forms/ImageUpload";
import { FoodPhoto } from "@/components/customer/FoodPhoto";
import { ScriptBubble, ScriptNote, Sparks } from "@/components/customer/Motifs";
import { LastOrderBanner } from "@/components/customer/LastOrderBanner";
import { track } from "@/lib/analytics/track";
import { captureAttribution } from "@/lib/analytics/attribution";
import { RESULT_PROMISE } from "@/lib/constants";

interface StepUploadProps {
  cartFile: File | null;
  checkoutFile: File | null;
  /** The first screenshot is still being read, so we cannot say yet. */
  cartReading: boolean;
  /** It carried a printed final total beside its fees - nothing else is needed. */
  cartSettlesTheBill: boolean;
  /** It was read in full and came back without one - now we know, not guess. */
  cartConfirmedShort: boolean;
  /** `original` is the untouched file, before it was compressed for upload. */
  onCartChange: (file: File | null, original?: File | null) => void;
  onCheckoutChange: (file: File | null, original?: File | null) => void;
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
  onCartChange,
  onCheckoutChange,
  error,
  onContinue,
}: StepUploadProps) {
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

  // The top of the funnel. Recorded once when this screen first appears, which
  // is the only moment that means "somebody arrived".
  useEffect(() => {
    // An advert can point straight here rather than at the landing page, and if
    // it does, this screen is the only one that ever sees the campaign
    // parameters. Captured before the count, and a no-op when the landing page
    // already did it - first touch wins.
    captureAttribution();
    track("wizard_started");
  }, []);

  return (
    <>
      {/* Hero banner. The spread bleeds past the top edge, as in the reference. */}
      <div className="relative rounded-3xl bg-linear-to-r from-brand-100 to-beige px-4 py-4">
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

      {/* Above everything, because somebody who already has an order in flight
          is not here to start another one. */}
      <LastOrderBanner />

      <h1 className="relative mt-4 inline-flex items-start text-[1.9rem] font-extrabold leading-tight text-ink-900">
        Upload your order
        <Sparks className="ml-1 h-5 w-5 shrink-0" />
      </h1>
      <p className="mt-1.5 text-[0.95rem] leading-relaxed text-slate-600">
        {cartSettlesTheBill
          ? "Your screenshot shows the total already — you're set. Add the checkout screen only if you want to."
          : cartConfirmedShort
            ? "Your cart screenshot doesn't show a total — add the checkout screen below for an exact comparison."
            : "Upload your cart screenshot. If your app keeps the total on a separate screen, add that one too."}
      </p>

      {/* Repeated from the landing page on purpose. This is the screen where
          somebody weighs the wait against the effort of finding a screenshot,
          and the answer to "how long will this take" belongs next to that
          decision, not one screen behind it. */}
      <p className="mt-2.5 inline-block rounded-full bg-brand-100 px-3.5 py-1.5 text-[0.85rem] font-bold text-ink-800">
        Your result, usually {RESULT_PROMISE}
      </p>

      <div className="mt-4 space-y-3">
        <ImageUpload
          step={1}
          label="Order details"
          hint="Restaurant and selected items"
          helper="Make sure your restaurant name and ordered items are visible."
          requirement="required"
          art="cartDoc"
          example="cart"
          file={cartFile}
          onChange={onCartChange}
          error={error}
        />

        {/* Withdrawn, not just quieted, once the first screenshot settles the
            bill - the slot stays on the screen but stops being asked for.
            Confirmed short, the pill still says Recommended; only the
            emphasize prop changes, because a read that came back with items
            and no payment summary is the one case here where we know, rather
            than guess, that this slot is what completes the comparison - and
            knowing that earns a stronger look, not a stronger rule. */}
        <ImageUpload
          step={2}
          label="Final checkout total"
          hint={
            cartSettlesTheBill
              ? "Already covered by your first screenshot"
              : cartConfirmedShort
                ? "Your total wasn't on the first screenshot"
                : "Fees, discounts and final total"
          }
          helper={
            cartSettlesTheBill
              ? "Your first screenshot already showed the fees and total, so you can skip this."
              : cartConfirmedShort
                ? "We read your cart screenshot but didn't find a total on it — add this one so we compare the right number."
                : cartReading
                  ? "Checking your first screenshot — add this if your total is on a different screen."
                  : "Recommended for the most accurate comparison — this shows your discounts, fees and final total."
          }
          requirement={cartSettlesTheBill ? "optional" : "recommended"}
          emphasize={cartConfirmedShort}
          art="receipt"
          example="checkout"
          allowRemove
          file={checkoutFile}
          onChange={onCheckoutChange}
        />
      </div>

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
    </>
  );
}
