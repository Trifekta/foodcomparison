import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

/**
 * Two voices, and only two.
 *
 * Plus Jakarta Sans does everything functional - the cart, the labels, the CTA.
 * Instrument Serif appears four times in eighteen seconds: on 87, on 25, on the
 * food line, and nowhere else. The contrast is the point, so the serif is
 * rationed rather than adopted.
 */

export const SANS = "Plus Jakarta Sans";
export const SERIF = "Instrument Serif";

loadFont({
  family: SANS,
  url: staticFile("fonts/plus-jakarta-sans-latin.woff2"),
  format: "woff2",
  weight: "200 800",
});

loadFont({
  family: SERIF,
  url: staticFile("fonts/instrument-serif-latin.woff2"),
  format: "woff2",
  weight: "400",
});
