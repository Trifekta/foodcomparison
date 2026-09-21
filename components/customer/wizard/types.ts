import type { CartItem, SubmissionFields } from "@/lib/validation/submission";

/** Text values held by react-hook-form. Files and items live in component state. */
export type WizardValues = SubmissionFields;

export interface WizardFiles {
  cart: File | null;
  checkout: File | null;
}

/** What a row originally was when the model proposed it, for comparison later. */
export interface ProposedItem {
  name: string;
  quantity: number;
  linePrice: string | null;
}

/**
 * A row in the item list, as it is being edited.
 *
 * `quantity` is a number because the stepper is the only way to change it, so
 * it can never hold a half-typed value; `name` is free text and a blank row is
 * simply one nobody has filled in. `key` is a stable React key that survives
 * reordering and deletion - the name is not unique enough for that.
 *
 * `proposed` is unused on the customer path, which is entirely typed, and is
 * kept because the source labelling below is shared with the admin extraction
 * flow, where a row genuinely can start as a machine suggestion.
 */
export interface CartItemDraft {
  key: string;
  name: string;
  quantity: number;
  /** Fixed-2 decimal string, or null when no price was read for this row. */
  linePrice: string | null;
  /**
   * The read flagged this price as not trustworthy - usually a currency glyph
   * OCR welded onto the number, turning 39.00 into 539.00. Only ever set where
   * there is evidence, so it stays a signal rather than decoration.
   */
  priceUncertain?: boolean;
  proposed: ProposedItem | null;
}

/** How the free screenshot read is going, as far as the wizard is concerned. */
export type ExtractionStatus = "idle" | "reading" | "applied" | "empty";

/** Totals read off the screenshot, shown back so the customer can check them. */
export interface ReadTotals {
  subtotal: string;
  deliveryFee: string;
  serviceFee: string;
  discount: string;
  finalTotal: string;
}

/**
 * Three screens: the cart, the total, then confirm and send.
 *
 * It was four, then two, and is now three - which is not a retreat. The two
 * were upload and confirm, and "upload" quietly held three jobs: the cart
 * screenshot, the checkout screenshot, and a total typed by hand. The second
 * of those is what turns a subtotal into the number somebody actually paid,
 * and on one screen it sat below the fold behind the card that had just been
 * satisfied. Plenty of people never scrolled to it.
 *
 * So the screen that was doing two jobs now does one each, and each hands over
 * by itself once its screenshot has been read (see autoAdvanceTarget). The
 * count went up; the work per screen went down, and nothing is scrolled past.
 *
 * No "Step n of m" anywhere - the bar carries it. Naming a number invites the
 * comparison this change would lose, and the honest thing to show is how much
 * is left, which is what a bar is for.
 */
export const TOTAL_STEPS = 3;

export const WIZARD_DEFAULTS: WizardValues = {
  restaurantName: "",
  areaId: "",
  currentTotal: "",
  // Blank, not "no" - the schema's "yes" | "no" has no room for "not yet
  // answered", the same way areaId's uuid type has no room for "not yet
  // picked". The cast is what areaId gets for free from z.uuid() inferring to
  // plain string; an enum's literal union needs it said explicitly. Either
  // way "" fails validation and the wizard will not advance past it silently.
  newToKeeta: "" as WizardValues["newToKeeta"],
  dialCode: "+971",
  whatsappNumber: "",
  marketingConsent: false,
};

/** Rows the customer left blank are dropped; the list is optional. */
export function usableItems(items: CartItemDraft[]): CartItem[] {
  return items.flatMap((item) => {
    const name = item.name.trim();
    if (!name) return [];

    const unchanged =
      item.proposed !== null &&
      item.proposed.name === item.name &&
      item.proposed.quantity === item.quantity &&
      item.proposed.linePrice === item.linePrice;

    return [
      {
        name,
        quantity: item.quantity,
        linePrice: item.linePrice,
        source: item.proposed === null ? "customer" : unchanged ? "extracted" : "edited",
      } as CartItem,
    ];
  });
}

/**
 * Whether the item list should open itself rather than wait to be asked.
 *
 * Folding the items away is the point of the confirm screen: an extraction
 * that got everything right does not need every row scrolled past, and most
 * of them do. But "most" is the whole problem with hiding them unconditionally
 * - the rows that need a human are precisely the ones a collapsed panel makes
 * invisible, and the customer is the only person in this flow holding the
 * phone the screenshot came off.
 *
 * So it opens on evidence, not on suspicion:
 *
 *  - a row whose price the read flagged. priceUncertain is only ever set where
 *    there is something to see - a currency glyph welded onto a number, 39.00
 *    read as 539.00 - and it renders a "check" badge that is worth nothing
 *    inside a closed panel.
 *  - nothing read at all. An empty list behind "View or edit items" is a dead
 *    end for somebody whose screenshot could not be parsed; open, it is an
 *    invitation to type what they ordered.
 *
 * Still reading keeps it shut. The list is about to change, and a panel that
 * springs open and then fills itself is the worst version of both states.
 */
export function itemsNeedAttention(input: {
  status: ExtractionStatus;
  items: CartItemDraft[];
}): boolean {
  if (input.status === "reading") return false;
  if (input.items.length === 0) return true;
  return input.items.some((item) => item.priceUncertain === true);
}

/** Which screenshot a read belongs to. Both are read; each is believed about
 *  a different thing - the cart for what was ordered, the payment screen for
 *  what it came to. */
export type ReadSlot = "cart" | "checkout";

/** True when a read found at least one figure worth showing. */
export function hasAnyTotal(totals: ReadTotals | null): totals is ReadTotals {
  return totals !== null && Object.values(totals).some((value) => value !== "");
}

/**
 * One set of figures out of two screenshots.
 *
 * The cart screen lists what was ordered, but the payment screen is where the
 * money is actually settled: fees added, discount applied, delivery counted.
 * So wherever the payment screen was read, it wins - field by field, because
 * OCR routinely loses one line and not the next, and a figure the cart screen
 * did read is better than a blank row.
 */
export function mergeReadTotals(
  cart: ReadTotals | null,
  checkout: ReadTotals | null,
): ReadTotals | null {
  if (!hasAnyTotal(checkout)) return cart;
  if (!cart) return checkout;

  const pick = (from: keyof ReadTotals) => (checkout[from] !== "" ? checkout[from] : cart[from]);

  return {
    subtotal: pick("subtotal"),
    deliveryFee: pick("deliveryFee"),
    serviceFee: pick("serviceFee"),
    discount: pick("discount"),
    finalTotal: pick("finalTotal"),
  };
}

/**
 * One banner out of two reads.
 *
 * Still reading anything means still reading: the totals on screen may yet
 * change, and saying so is more honest than showing a settled result that is
 * about to move. Otherwise anything found beats nothing found.
 */
export function combineStatus(
  cart: ExtractionStatus,
  checkout: ExtractionStatus,
): ExtractionStatus {
  const both = [cart, checkout];
  if (both.includes("reading")) return "reading";
  if (both.includes("applied")) return "applied";
  if (both.includes("empty")) return "empty";
  return "idle";
}

/**
 * Whether the screenshots settled the bill, or only listed the food.
 *
 * The question the caveat on a result actually turns on, and it is not "how
 * many screenshots did they send". Talabat, noon and Keeta print the whole
 * payment summary - discount, delivery, service fee, total - on the cart page,
 * so one screenshot from any of them answers everything; Deliveroo splits it
 * across two screens, and is the only one of the four that needs both slots.
 *
 * Two conditions, together. A final total, which the extraction prompt is
 * forbidden to derive - it may only copy what is printed - so a non-empty value
 * is evidence the number was on the screen. And at least one fee or discount
 * line beside it, because that is what separates a payment summary from an item
 * list with a subtotal at the bottom, and the fees are precisely what the
 * caveat says we could not check.
 */
export function totalsAreSettled(totals: ReadTotals | null): boolean {
  if (!totals || !totals.finalTotal) return false;
  return totals.deliveryFee !== "" || totals.serviceFee !== "" || totals.discount !== "";
}

/**
 * The one figure worth offering as an answer, out of everything read.
 *
 * Not "whatever final_total holds" - a Keeta basket screen can print "Order
 * total AED 71.95" in the same type and position a real payment summary
 * uses, while a delivery fee still waits to be added at checkout. The
 * extraction has no way to know that from the number alone; only
 * totalsAreSettled's evidence - a fee or discount printed beside it - says
 * this screen is done adding things up.
 *
 * Used everywhere a read total is about to become the customer's own
 * answer: the silent autofill, the "Use this" hint, and the caveat's own
 * check of what was confirmed. Not used for the raw per-field display on the
 * basket-confirm step, which shows exactly what was read, unfiltered,
 * because that screen is not offering anything as the answer.
 */
export function trustedFinalTotal(totals: ReadTotals | null): string {
  return totalsAreSettled(totals) ? (totals?.finalTotal ?? "") : "";
}

/**
 * What kind of figure the read is offering as the customer's own total.
 *
 * "settled" is a bill that is done adding itself up - a printed total with a
 * fee or a discount beside it - and it is the only one that can be compared
 * like for like against the price an admin finds on Keeta, which is always a
 * grand total.
 *
 * "subtotal" is the food and nothing else: an item list whose screen never
 * showed delivery or service. Perfectly real, and NOT the same number. Filling
 * it in silently would understate every saving we quote, so everywhere it
 * reaches the customer it has to be labelled for what it is - and it never
 * satisfies the confirmation flag that suppresses the unverified-total note.
 */
export type TotalKind = "settled" | "subtotal" | "none";

export interface TotalOffer {
  value: string;
  kind: TotalKind;
}

/**
 * The best figure the screenshots actually printed, and what it is.
 *
 * The rule this replaces offered a settled bill or nothing at all, which left
 * a Deliveroo customer staring at an empty required field with the number
 * sitting right there on the screenshot they had just sent. Offering it is
 * better - provided nobody is told it is something it is not.
 *
 * Three readings, in order of how complete they are:
 *
 *  - a total with fees beside it. Settled: this is what they paid.
 *  - a total with NO fees beside it. This is the case the old rule threw away
 *    wholesale, and it was right that the number cannot be trusted as a final
 *    bill - a Keeta basket prints "Order total AED 71.95" with delivery still
 *    to come. But it is a perfectly good pre-fees figure, so it is offered as
 *    one rather than discarded.
 *  - a subtotal line and nothing else. The Deliveroo shape.
 *
 * Fees and discounts alone, with no total of any kind, offer nothing: adding
 * them up ourselves is exactly what the extraction prompt is forbidden to do.
 */
export function readTotalOffer(totals: ReadTotals | null): TotalOffer {
  if (!totals) return { value: "", kind: "none" };
  if (totalsAreSettled(totals)) return { value: totals.finalTotal, kind: "settled" };
  if (totals.finalTotal !== "") return { value: totals.finalTotal, kind: "subtotal" };
  if (totals.subtotal !== "") return { value: totals.subtotal, kind: "subtotal" };
  return { value: "", kind: "none" };
}

/**
 * Where a screen hands over to, once its screenshot has been read.
 *
 * Null means stay put. The rule is small and the consequences are not, so it
 * is here with a test rather than inline in an effect:
 *
 *  - nothing read yet, or still reading, and nobody is moved. A screen that
 *    changes under a thumb is how a mis-tap happens.
 *  - from the cart screen, a bill that is already settled skips the total
 *    screen entirely. There is nothing left to ask for: the fees and the
 *    total were on the screenshot they already sent, and putting a screen in
 *    front of them to say so is the friction this whole flow is against.
 *  - the total screen NEVER hands over, and that is the point of it. Its read
 *    finishing is the moment it finally has something to say - here is what
 *    you paid - and moving then is moving at exactly the wrong time: the
 *    number appears and the screen carrying it leaves in the same breath. A
 *    customer who uploads a payment summary and never sees their own total
 *    has been shown nothing. It fills the field, rolls it into view, and
 *    waits for Continue. The same holds when the read finds nothing, for the
 *    mirror reason: that screen is where they type the number themselves.
 *  - a screen hands over once and never again, and Back switches it off for
 *    the screen it lands on. Otherwise Back is a button that throws you
 *    forward, which is worse than no Back.
 */
export function autoAdvanceTarget(input: {
  /** Which screen the customer is on now. */
  step: number;
  /** How the read for THIS screen's screenshot is going. */
  status: ExtractionStatus;
  /** Whether that screenshot has been chosen at all. */
  hasFile: boolean;
  /** Whether the cart screenshot carried the fees and the total. */
  cartSettled: boolean;
  /** This screen has already handed over once. */
  alreadyAdvanced: boolean;
}): number | null {
  if (input.alreadyAdvanced || !input.hasFile) return null;
  if (input.status === "reading" || input.status === "idle") return null;
  if (input.step === 1) return input.cartSettled ? 3 : 2;
  // Everything past the cart screen holds. See the note above.
  return null;
}

/**
 * Whether the second upload slot should stop hedging and say so.
 *
 * Pulled out of the JSX that reads it for the same reason shouldAutofillTotal
 * was: it is a decision, not a rendering detail, and a decision is worth
 * pinning down with a test rather than eyeballed on a screen.
 *
 * True only once the cart screenshot has been read in full and it did not
 * carry a settled bill - an item list with no payment summary under it, the
 * Deliveroo shape. Before that read finishes, or once it has confirmed the
 * bill is already settled, there is nothing to escalate: either the question
 * is still open, or it is already answered the good way.
 */
export function cartConfirmedShort(input: {
  /** Whether a cart screenshot has been chosen at all. */
  hasCartFile: boolean;
  /** The cart screenshot is still being read. */
  cartReading: boolean;
  /** What that read came back with, once it is done. */
  cartSettled: boolean;
}): boolean {
  if (!input.hasCartFile || input.cartReading) return false;
  return !input.cartSettled;
}

/**
 * Whether to put the total read off a screenshot into the field for them.
 *
 * Pulled out of the effect that calls it so the one rule with a decision in it
 * can be tested: an effect needs a browser, and this needs to be right. The
 * caller keeps the memory - what it last filled in - and passes it back.
 */
export function shouldAutofillTotal(input: {
  /**
   * The figure the read is offering - a settled bill or a pre-fees subtotal,
   * whichever the screenshots actually printed. "" when they printed neither.
   */
  readFinalTotal: string;
  /** What is in the field now. */
  typed: string;
  /** What this filled in last time, if anything. */
  lastAutofilled: string | null;
}): boolean {
  if (!input.readFinalTotal) return false;
  // Already done, and not undone by them.
  if (input.lastAutofilled === input.readFinalTotal) return false;
  // Their own reading of their own screen beats ours. Only an empty field, or
  // one still holding a number we put there, may be written over.
  if (input.typed && input.typed !== input.lastAutofilled) return false;
  return true;
}
