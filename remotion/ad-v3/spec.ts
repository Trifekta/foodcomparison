import { CURRENCY } from "@/lib/constants";

/**
 * V3 - a continuous motion-design film.
 *
 * The structural difference from V2 is that there are no scenes. V2 was a
 * `Series` of seven components that mounted and unmounted; this is one stage
 * that runs for eighteen seconds, with layers fading through it and a single
 * set of scan brackets travelling the whole length as the protagonist.
 *
 * That means every number below is an absolute frame in one timeline, and acts
 * are just names for stretches of it.
 */

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;
export const DURATION_IN_FRAMES = 540; // 18.0s

export const sec = (s: number) => Math.round(s * FPS);

/** Act boundaries, from the brief. */
export const ACT = {
  cart: { in: 0, out: sec(2.2) }, //      0 -  66
  capture: { in: sec(2.2), out: sec(4.5) }, //  66 - 135
  scan: { in: sec(4.5), out: sec(7.7) }, //    135 - 231
  payoff: { in: sec(7.7), out: sec(11.5) }, // 231 - 345
  food: { in: sec(11.5), out: sec(13.8) }, //  345 - 414
  resolve: { in: sec(13.8), out: sec(18.0) }, // 414 - 540
} as const;

/**
 * The beats inside the payoff, which is the only stretch with internal
 * structure worth naming.
 *
 * The pause between 87 landing and 25 arriving is the most important empty
 * space in the film: it is what stops the payoff reading as a discount-store
 * price flash, and it is where the silence in the mix lives.
 */
export const PAYOFF = {
  /** The scan wipe finishes and the world is dark. */
  dark: sec(7.4),
  /** 112 sits small and secondary. */
  small112: sec(8.0),
  /** 87 resolves out of it. Controlled impact. */
  land87: sec(9.0),
  /** Nothing happens for 1.2s. On purpose. */
  land25: sec(10.2),
} as const;

/**
 * The cart.
 *
 * Six lines totalling exactly 112, so the figure survives being read. Dinner
 * for two: two mains, two sides, two drinks, fees.
 */
export const CART = {
  restaurant: "Al Safadi",
  meta: "Deira · Lebanese",
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

/** The same basket on Keeta, and why it comes out lower. */
export const COMPARISON = {
  app: "Keeta",
  lines: ["52.00", "15.00", "10.00", "10.00", "0.00", "0.00"],
  total: "87.00",
} as const;

export const PRICE = {
  currency: CURRENCY,
  old: "112",
  new: "87",
  saving: "25",
} as const;

// The figures on screen have to reconcile, and the ad must never render if they
// do not. This is what stops an AED 24.98 appearing anywhere.
if (Number(PRICE.old) - Number(PRICE.new) !== Number(PRICE.saving)) {
  throw new Error(`${PRICE.old} - ${PRICE.new} is not ${PRICE.saving}`);
}
if (CART.lines.reduce((t, l) => t + Number(l.price), 0) !== Number(CART.total)) {
  throw new Error("cart lines do not total the headline price");
}
if (COMPARISON.lines.reduce((t, p) => t + Number(p), 0) !== Number(COMPARISON.total)) {
  throw new Error("comparison lines do not total the comparison price");
}

export const COPY = {
  headline: `${CURRENCY} ${PRICE.old} for dinner?`,
  checkFirst: "Check first.",
  scanRestaurant: "Restaurant found",
  scanItems: "Items matched",
  scanKeeta: `Checking ${COMPARISON.app}`,
  saved: "saved",
  foodLine: "Same dinner.\nSmarter price.",
  ctaHead: "Before you order,\ncheck SnipSavor.",
  ctaSub: `Upload your cart. See if ${COMPARISON.app} costs less.`,
  ctaButton: "Check my cart",
} as const;

/**
 * The four voiceover moments.
 *
 * Placeholders until the read exists - nothing is rendered for them yet. The
 * film is designed to work silent, so these add emphasis rather than carry
 * meaning, and the picture never waits for a line.
 */
export const VOICE = [
  { id: "hook", from: sec(0.8), atMost: sec(1.6), text: "112 dirhams for dinner?" },
  { id: "eightyseven", from: PAYOFF.land87, atMost: sec(0.9), text: "87." },
  { id: "saved", from: PAYOFF.land25 + 4, atMost: sec(1.6), text: "That's 25 dirhams saved." },
  { id: "cta", from: sec(15.2), atMost: sec(1.8), text: "Check before you order." },
] as const;
