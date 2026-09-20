/**
 * The Meta Pixel, which is how a paid ad on Facebook or Instagram learns that
 * the click it bought turned into a visit.
 *
 * The id is public by nature - it is written into the page for Meta's script to
 * read - so it lives in a NEXT_PUBLIC_ value and is inlined at build time. The
 * account's own id is the default so a deployment that sets nothing still
 * reports; setting the variable to an empty string is how a build opts out,
 * which is what a preview or a staging deploy should do rather than mixing its
 * traffic into the numbers an ad is judged by.
 */

/** The pixel this product's ads are run against. */
const DEFAULT_PIXEL_ID = "1483802690318405";

/**
 * Unset falls back to the default; deliberately blank switches tracking off.
 * The distinction is the reason for ?? rather than ||.
 */
export const META_PIXEL_ID = (process.env.NEXT_PUBLIC_META_PIXEL_ID ?? DEFAULT_PIXEL_ID).trim();

/**
 * Whether this build loads the pixel at all.
 *
 * Read by /privacy as well as by the component, so the disclosure describes
 * what the deployment actually does rather than what it usually does.
 */
export function isMetaPixelConfigured(): boolean {
  return META_PIXEL_ID.length > 0;
}
