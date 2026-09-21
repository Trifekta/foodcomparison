"use client";

import { Button } from "@/components/ui/Button";
import { StepActions } from "./StepActions";
import { ImageUpload } from "@/components/forms/ImageUpload";
import { AmountInput } from "@/components/forms/AmountInput";
import type { ExtractionStatus, TotalKind } from "./types";

interface StepTotalProps {
  checkoutFile: File | null;
  /** The cart screenshot is still being read. */
  cartReading: boolean;
  /** It carried a printed final total beside its fees - nothing else is needed. */
  cartSettlesTheBill: boolean;
  /** It was read in full and came back without one - now we know, not guess. */
  cartConfirmedShort: boolean;
  /** How the read for the screenshot on THIS screen is going. */
  checkoutStatus: ExtractionStatus;
  /** What the read offered, so this screen never calls a subtotal a final total. */
  totalKind: TotalKind;
  /** The field holds a figure we read, rather than one they typed. */
  prefilledFromScreenshot: boolean;
  manualTotal: string;
  onManualTotalChange: (value: string) => void;
  /** Only ever a format complaint: this field is optional on this screen. */
  totalError?: string;
  onCheckoutChange: (file: File | null, original?: File | null) => void;
  onCheckoutPicked: (file: File) => void;
  onContinue: () => void;
}

/**
 * What the order actually came to.
 *
 * This was the bottom half of the upload screen, and being the bottom half was
 * its whole problem. The card above it had just been satisfied - a green tick,
 * a thumbnail, a job visibly done - and underneath that, below the fold, sat
 * the one thing that turns a subtotal into the number somebody really paid.
 * Plenty of people never scrolled.
 *
 * On its own screen it is unmissable, and it still asks for nothing anybody
 * cannot give: a screenshot if they have one, a number typed by hand if they
 * do not, and Continue either way. It is skipped entirely when the cart
 * screenshot already settled the bill, because then there is nothing here to
 * ask.
 */
export function StepTotal({
  checkoutFile,
  cartReading,
  cartSettlesTheBill,
  cartConfirmedShort,
  checkoutStatus,
  totalKind,
  prefilledFromScreenshot,
  manualTotal,
  onManualTotalChange,
  totalError,
  onCheckoutChange,
  onCheckoutPicked,
  onContinue,
}: StepTotalProps) {
  // What the field is holding, and only while it is still OUR figure - the
  // moment they type over it, it is theirs and neither of these is true.
  const subtotalOnly = prefilledFromScreenshot && totalKind === "subtotal";
  const settledFill = prefilledFromScreenshot && totalKind === "settled";

  // Asked and answered. Which screenshot settled the bill does not matter here;
  // that the customer has already given us one does.
  const checkoutAnswered = checkoutFile !== null && checkoutStatus !== "reading";

  /**
   * Whether the card below is still offering a way out, or holding a figure.
   *
   * It is a question - "Don't have a checkout screenshot?" - only while nobody
   * has given us one and nothing has been read. Every other state names the
   * number it is holding, and then the field must NOT repeat that name: the
   * heading has said it, one line up.
   */
  const askingForOne =
    !cartSettlesTheBill && !settledFill && !subtotalOnly && checkoutFile === null;
  const fieldLabel = subtotalOnly ? "Your order subtotal" : "Your final total";


  return (
    <>
      <h1 className="text-[1.9rem] font-extrabold leading-tight text-ink-900">
        {settledFill || subtotalOnly ? "Check your total" : "What did it come to?"}
      </h1>
      <p className="mt-1.5 text-[0.95rem] leading-relaxed text-slate-600">
        {settledFill
          ? "We read this off your screenshot. A quick look is all it needs."
          : subtotalOnly
            ? "We read the food, but not the fees. Add the checkout screen and we'll read the rest."
            : "Discounts, fees and delivery change the comparison, so we need the number you actually pay."}
      </p>
      <span aria-hidden="true" className="mt-1.5 block h-[3px] w-16 rounded-full bg-brand-400" />

      <div className="mt-4 space-y-3">
      {/* Withdrawn, not just quieted, once the first screenshot settles the
          bill - the slot stays on the screen but stops being asked for.
          Confirmed short, the pill still says Recommended; only the
          emphasize prop changes, because a read that came back with items
          and no payment summary is the one case here where we know, rather
          than guess, that this slot is what completes the comparison - and
          knowing that earns a stronger look, not a stronger rule. */}
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
        /* Once a second screenshot exists, this line stops asking for one and
           reports what became of it. It used to be decided entirely by the
           CART read, so it went on saying "add this one so we compare the
           right number" to somebody looking at the one they had added. */
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
                    : "Recommended for the most accurate comparison — this shows your discounts, fees and final total."
        }
        requirement={cartSettlesTheBill ? "optional" : "recommended"}
        emphasize={cartConfirmedShort && checkoutFile === null}
        art="receipt"
        example="checkout"
        allowRemove
        file={checkoutFile}
        onChange={onCheckoutChange}
        onFilePicked={onCheckoutPicked}
      />

      {/* The way through for somebody who cannot produce that screenshot.
          Deliberately not a peer of the slot above it - a toggle offering
          "photograph it OR type it" is answered by almost everybody with the
          two-second option, and the two are not equivalent. The screenshot
          is read, and the number it prints is checked against what the
          customer says they paid; that agreement is the whole of what lets
          a result claim the fees were verified rather than taken on trust.
          Typed alone, the figure is still perfectly usable - it is just
          unverified, and the result says so.

          So: a fallback, under an OR, in a quieter card, with the
          recommendation restated beneath it. Everybody who can send the
          screenshot still does; nobody who cannot is stopped. */}
      <div className="relative py-0.5">
        <span aria-hidden="true" className="absolute inset-x-0 top-1/2 h-px bg-ink-200" />
        <span className="relative mx-auto block w-12 bg-canvas text-center text-[0.78rem] font-bold uppercase tracking-wide text-slate-500">
          or
        </span>
      </div>

      <div className="rounded-3xl bg-cream p-3.5 ring-1 ring-sand">
        {/* Three states, because the card answers a different question in
            each. Once the first screenshot has settled the bill it holds the
            number we already read. Once it has given us the food but no fees
            it holds THAT, said out loud - a subtotal quietly presented as a
            final total is how a saving gets understated. Before either, it
            is the way through for somebody who cannot produce the checkout
            screen at all. */}
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

      <StepActions>
        <Button onClick={onContinue} arrow>
          Continue
        </Button>
      </StepActions>
    </>
  );
}
