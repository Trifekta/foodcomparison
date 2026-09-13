import {
  BRAND_NAME,
  CURRENCY,
  LAUNCH_CITY,
  RESULT_PROMISE_MINUTES,
} from "@/lib/constants";

/**
 * Everything about the ad that a person might want to change without opening a
 * scene: how long each beat runs, what the basket costs, and what the columns
 * are called.
 *
 * The reference cut this product category into nine beats in eighteen seconds,
 * and that rhythm is the thing worth copying - a beat every two seconds, one
 * idea each, hard cuts. The durations below are frames at 30fps, so 60 is the
 * two-second beat and anything longer is a deliberate hold.
 */

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

/**
 * Scene lengths in frames, in order. The composition's total duration is the
 * sum of these rather than a number typed twice, so a beat can be lengthened
 * without the last scene falling off the end of the video.
 */
export const BEATS = {
  /** "8:41 PM" - the moment before checkout. */
  craving: 60,
  /** The one photographic shot. Generated footage goes here. */
  broll: 60,
  /** The mark assembling inside its construction circles. */
  icon: 60,
  /** One screenshot is all we need. */
  upload: 60,
  /** The same basket, rebuilt line by line. */
  rebuild: 60,
  /** Two totals, side by side. */
  compare: 45,
  /** The number. Held longest on purpose - it is the only thing to remember. */
  savings: 90,
  /** The message that actually reaches the customer. */
  notification: 45,
  /** Wordmark and the promise. */
  lockup: 60,
} as const;

export const DURATION_IN_FRAMES = Object.values(BEATS).reduce(
  (total, beat) => total + beat,
  0,
);

/**
 * The basket shown on screen.
 *
 * Real Dubai numbers rather than round ones: a basket that costs exactly AED
 * 100 reads as an illustration, and the saving is the claim the whole ad rests
 * on. Keep `saving` equal to `cartTotal - comparisonTotal` - it is written out
 * rather than computed so that the figure on screen is the figure somebody
 * approved.
 */
export const BASKET = {
  cartTotal: "112.00",
  comparisonTotal: "87.00",
  saving: "25.00",
  savingPercentage: 22,
  currency: CURRENCY,
  /** Read out under the clock in the opening beat. */
  clock: "8:41 PM",
  items: [
    { name: "Chicken shawarma", quantity: 2 },
    { name: "Hummus & pita", quantity: 1 },
    { name: "Mixed grill platter", quantity: 1 },
    { name: "Delivery & fees", quantity: null },
  ],
} as const;

/**
 * What the two columns in the comparison beat are called.
 *
 * Neutral by default, and deliberately so. Naming a competitor in a side-by-side
 * price claim is comparative advertising, which in the UAE wants legal sign-off
 * and substantiation for every basket shown. The product names the app it
 * rebuilt on because that is a private result for one customer; a public ad is
 * a different thing. Swap these for real app names once somebody has signed
 * that off - it is this one edit and nothing else.
 */
export const COLUMNS = {
  current: "The app you're on",
  comparison: "Same basket, another app",
} as const;

/**
 * Copy.
 *
 * Every line here is either already on a screen in the product or is the
 * README's own sentence for what this is. An ad that promises something the app
 * does not say when the customer arrives is a bounce.
 */
export const COPY = {
  cravingLead: "Your cart is ready.",
  cravingSub: `${CURRENCY} ${BASKET.cartTotal}, one tap from gone.`,
  brollLine: "Before you order,",
  brollEmphasis: "check if you can save.",
  uploadTitle: "Upload your cart",
  uploadSub: "One screenshot is all we need.",
  rebuildTitle: "We rebuild the same basket on another app.",
  compareTitle: "Same food. Two prices.",
  savingsLead: "You could save",
  savingsSub: `${BASKET.savingPercentage}% less on the other app`,
  notificationApp: BRAND_NAME,
  notificationTitle: "Your result is ready",
  notificationBody: `We rebuilt your basket and found ${CURRENCY} ${BASKET.saving} of difference.`,
  notificationWhen: `${RESULT_PROMISE_MINUTES} min`,
  tagline: "Before you order, check if you can save.",
  city: `Now in ${LAUNCH_CITY}`,
} as const;
