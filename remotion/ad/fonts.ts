import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

/**
 * The two faces the product is set in, loaded from public/fonts/.
 *
 * Self-hosted rather than fetched from Google at render time, for the same
 * reason app/layout.tsx self-hosts them through next/font: a render that
 * reaches out to fonts.gstatic.com is a render that fails on a plane, behind a
 * corporate proxy, or in CI - and it fails by silently substituting a system
 * sans, which is the worst possible failure for a brand asset because the video
 * still comes out, just wrong.
 *
 * Both files are the variable builds, so one file per family covers every
 * weight the app uses. Together they are under 100KB.
 *
 * The family names match what Tailwind resolves --font-jakarta and
 * --font-caveat to, so the utility classes and the script/marker utilities in
 * globals.css behave exactly as they do in the browser.
 */

export const JAKARTA_FAMILY = "Plus Jakarta Sans";
export const CAVEAT_FAMILY = "Caveat";

loadFont({
  family: JAKARTA_FAMILY,
  url: staticFile("fonts/plus-jakarta-sans-latin.woff2"),
  format: "woff2",
  // The variable build carries the whole range; the app uses 400 through 800.
  weight: "200 800",
});

loadFont({
  family: CAVEAT_FAMILY,
  url: staticFile("fonts/caveat-latin.woff2"),
  format: "woff2",
  weight: "400 700",
});
