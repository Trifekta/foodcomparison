import { BRAND_NAME, CURRENCY } from "@/lib/constants";

/**
 * V2: a vertical performance ad, cut to a grid.
 *
 * The single structural difference from V1 is that this one is timed to music
 * before a frame of it is drawn. The track is 120bpm, which at 30fps is exactly
 * 15 frames to the beat and 60 to the bar, so every cut below lands on a beat
 * and the two that matter most - the saving, and the end card - land on bar
 * downbeats. Editing to the music is not something done afterwards in a timeline;
 * it is this table.
 */

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;

export const BPM = 120;
/** 30fps / (120bpm / 60s) = 15. */
export const FRAMES_PER_BEAT = (FPS * 60) / BPM;
export const FRAMES_PER_BAR = FRAMES_PER_BEAT * 4;

/** Frame of the nth beat, for placing a hit or reading a cut off the grid. */
export const beat = (n: number) => Math.round(n * FRAMES_PER_BEAT);

/**
 * Where each act starts and ends, in frames.
 *
 * Written as absolute marks rather than durations because the thing that has to
 * be true is that a cut lands on a beat, and that is checkable by eye here: every
 * number below is divisible by 15.
 */
export const MARKS = {
  hookIn: beat(0), //      0   0.0s
  interruptIn: beat(5), // 75   2.5s
  uploadIn: beat(8), //   120   4.0s
  compareIn: beat(13), // 195   6.5s
  revealIn: beat(17), //  255   8.5s
  humanIn: beat(23), //   345  11.5s
  ctaIn: beat(28), //     420  14.0s
  end: beat(35), //       525  17.5s
} as const;

export const DURATION_IN_FRAMES = MARKS.end;

/** Length of an act, from the marks, so the two can never disagree. */
export const span = (from: keyof typeof MARKS, to: keyof typeof MARKS) =>
  MARKS[to] - MARKS[from];

/**
 * The beats inside the payoff, which is the only act with internal structure
 * worth naming. `saveHit` is a bar downbeat - the strongest musical accent in
 * the track, the frame the saving lands, and the frame the voiceover says
 * "saved". All three are the same moment on purpose.
 */
export const PAYOFF = {
  /** 112 is still on screen, carried from the comparison. */
  holdOld: beat(17), //     255  8.5s
  /** It snaps to 87. */
  snapNew: beat(19), //     285  9.5s
  /** SAVE AED 25. Bar downbeat, biggest hit in the ad. */
  saveHit: beat(20), //     300 10.0s
} as const;

/**
 * The cart.
 *
 * It has to add up, and it has to look like a real Friday-night order for two
 * rather than a number chosen to sound impressive. A viewer who thinks "that is
 * not what a hundred and twelve dirhams buys" has stopped listening to the rest
 * of the ad, so the lines below total exactly 112 and read as two mains, two
 * sides, two drinks and fees.
 */
export const CART = {
  restaurant: "Al Safadi",
  lines: [
    { name: "Chicken shawarma platter", qty: 2, price: "62.00" },
    { name: "Hummus & pita", qty: 1, price: "18.00" },
    { name: "Garlic bread", qty: 1, price: "12.00" },
    { name: "Soft drinks", qty: 2, price: "10.00" },
    { name: "Delivery", qty: null, price: "6.00" },
    { name: "Service fee", qty: null, price: "4.00" },
  ],
  total: "112.00",
} as const;

/**
 * The same basket on the other app, and why it comes out lower. A saving with no
 * visible cause reads as a trick; two cheaper lines and a waived delivery fee is
 * how it actually happens.
 */
export const COMPARISON = {
  app: "Keeta",
  lines: [
    { name: "Chicken shawarma platter", qty: 2, price: "52.00" },
    { name: "Hummus & pita", qty: 1, price: "15.00" },
    { name: "Garlic bread", qty: 1, price: "10.00" },
    { name: "Soft drinks", qty: 2, price: "10.00" },
    { name: "Delivery", qty: null, price: "0.00" },
    { name: "Service fee", qty: null, price: "0.00" },
  ],
  total: "87.00",
} as const;

/**
 * The three numbers the whole ad rests on.
 *
 * `saving` is written out and asserted against the other two below rather than
 * formatted from a subtraction at render time, because the failure this guards
 * against is the ad showing 24.98 somewhere - a rounding artefact in one place
 * and a clean 25 in another is the kind of thing nobody notices until it is on
 * a phone in front of a customer.
 */
export const PRICE = {
  currency: CURRENCY,
  old: "112",
  new: "87",
  saving: "25",
} as const;

if (Number(PRICE.old) - Number(PRICE.new) !== Number(PRICE.saving)) {
  throw new Error(
    `The saving on screen does not match the prices on screen: ` +
      `${PRICE.old} - ${PRICE.new} is not ${PRICE.saving}.`,
  );
}

if (Number(CART.total) !== Number(PRICE.old)) {
  throw new Error(
    `The cart lines total ${CART.total} but the headline price is ${PRICE.old}.`,
  );
}

/**
 * Copy.
 *
 * SnipSavor does not cook, deliver, or place an order, so nothing here says
 * order, get, or delivered. Every line is some form of "check before you pay",
 * which is the actual product.
 */
export const COPY = {
  hook: `About to pay ${CURRENCY} ${PRICE.old} for dinner?`,
  hookPrice: `${CURRENCY} ${PRICE.old}`,
  interrupt: "Check first.",
  upload: "Upload your cart",
  scanning: `Checking ${COMPARISON.app}…`,
  scanFound: `Basket matched on ${COMPARISON.app}`,
  saveLead: "You save",
  saveAmount: `${CURRENCY} ${PRICE.saving}`,
  ctaHead: "Before you order,\ncheck SnipSavor.",
  ctaSub: `Upload your cart. See if ${COMPARISON.app} costs less.`,
  ctaButton: "Check my cart",
  brand: BRAND_NAME,
} as const;
