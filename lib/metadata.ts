import type { Metadata } from "next";
import { PRODUCT_NAME } from "@/lib/constants";
import { absoluteUrl } from "@/lib/env";

/**
 * Link previews.
 *
 * Every link this product sends leaves it: the result arrives on WhatsApp from
 * a number the customer has never seen, and a bare URL under that is the shape
 * a person has been taught not to tap. A card with the mark on it is the same
 * link wearing a face.
 *
 * WhatsApp builds the preview on the *sending* device and ships it inside the
 * encrypted message, so no third party ever fetches the URL - which matters
 * here, because for a result link the URL is the credential. Nothing in these
 * cards is generated per submission for the same reason: they are two static
 * images, and no basket, total or saving is ever written into a meta tag.
 */

/** The size every scraper expects, and what the artwork in /public/og is cut to. */
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;

/**
 * Absolute, or nothing at all.
 *
 * og:image is read by a scraper that has no page to resolve a relative path
 * against, so a relative one is not a worse card - it is no card. Next fills
 * the gap with metadataBase, and with NEXT_PUBLIC_APP_URL unset that base is
 * localhost: a tag pointing at a machine the reader does not have. Dropping the
 * image is the honest failure, and it is the same call absoluteUrl() already
 * makes for the result link itself.
 */
function imageCard(path: string, alt: string) {
  const url = absoluteUrl(path);
  if (!url) return undefined;
  return [{ url, width: OG_IMAGE_WIDTH, height: OG_IMAGE_HEIGHT, alt, type: "image/png" }];
}

interface SocialCardInput {
  /** Read aloud in the preview, so it leads with the brand for the same reason the message does. */
  title: string;
  description: string;
  /** Path under /public, e.g. "/og/result.png". */
  image: string;
  imageAlt: string;
  /**
   * Canonical address of the page. Omitted for the result page: that URL is a
   * credential, and it has no business being repeated in a tag when the page
   * answering the request is already at it.
   */
  path?: string;
}

/**
 * openGraph and twitter together, because a page that sets one and forgets the
 * other gets a large card in WhatsApp and a bare link in X.
 *
 * Returned whole rather than merged field by field: Next replaces a parent's
 * openGraph outright when a child declares one, so a page that spreads this in
 * inherits nothing from the layout and needs everything here.
 */
export function socialCard(input: SocialCardInput): Pick<Metadata, "openGraph" | "twitter"> {
  const images = imageCard(input.image, input.imageAlt);
  const url = input.path ? absoluteUrl(input.path) : null;

  return {
    openGraph: {
      type: "website",
      siteName: PRODUCT_NAME,
      locale: "en_AE",
      title: input.title,
      description: input.description,
      ...(url ? { url } : {}),
      ...(images ? { images } : {}),
    },
    twitter: {
      card: images ? "summary_large_image" : "summary",
      title: input.title,
      description: input.description,
      ...(images ? { images } : {}),
    },
  };
}
