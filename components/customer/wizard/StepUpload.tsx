"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { StepActions } from "./StepActions";
import { ImageUpload } from "@/components/forms/ImageUpload";
import { FoodPhoto } from "@/components/customer/FoodPhoto";
import { ScriptBubble, ScriptNote, Sparks } from "@/components/customer/Motifs";
import { LastOrderBanner } from "@/components/customer/LastOrderBanner";
import { ScrollDepth } from "@/components/customer/ScrollDepth";
import { FoodAppLinks } from "./FoodAppLinks";
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
  error,
  onContinue,
}: StepUploadProps) {
  // Whether a new cart screenshot has been picked on this visit. Local, not
  // read from cartFile: cartFile only updates once the display copy finishes
  // downscaling, and a slow phone on a big screenshot is exactly the case the
  // read's own latency fix (onFilePicked, ahead of that same downscale) exists
  // for. The banner should disappear on the same signal, not lag behind it.
  const [uploadStarted, setUploadStarted] = useState(false);

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
      {/* Mounted on this step alone, so its reading means "how far down the
          upload screen", not "how far down whichever step they were on". It
          sends when this unmounts, which is what advancing past it looks
          like. */}
      <ScrollDepth />

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

      {/* The fork, asked out loud. Everything below answers one of two states,
          and a first-timer from an advert is in the second one - which nothing
          on this screen used to acknowledge until they had scrolled past both
          upload slots. Withdrawn once a screenshot exists, because by then
          they have answered it. */}
      {cartFile ? null : (
        <h2 className="mt-5 text-[1.05rem] font-extrabold leading-tight text-ink-900">
          Already have your cart screenshot?
        </h2>
      )}

      <div className={cartFile ? "mt-4 space-y-3" : "mt-2.5 space-y-3"}>
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

        {/* Between the two slots, not under them.

            This is the "no" branch of the question above, so it belongs beside
            the "yes" branch rather than below the whole form - under both
            upload cards it began 1163px down, which is a screen and a half
            past where somebody without a screenshot gives up. Hidden the
            moment one is picked: they have answered the question, and an exit
            to another app in front of somebody one tap from finishing is a way
            to lose them. */}
        {cartFile ? null : <FoodAppLinks />}

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
          onFilePicked={(file) => {
            setUploadStarted(true);
            onCheckoutPicked(file);
          }}
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
