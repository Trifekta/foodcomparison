import { getPublicAreas } from "@/lib/areas";
import { currentUploadPromotion } from "@/lib/customer/promotion";
import { FOOD_APPS } from "@/lib/customer/food-apps";
import {
  ACCEPTED_IMAGE_TYPES,
  COMPARISON_APP,
  CURRENCY,
  DEFAULT_DIAL_CODE,
  DIAL_CODES,
  IMAGE_MAX_DIMENSION,
  MAX_CART_ITEMS,
  MAX_IMAGE_BYTES,
  MAX_ITEM_NAME_LENGTH,
  MAX_ITEM_QUANTITY,
  MAX_RESTAURANT_NAME_LENGTH,
  MAX_TOTAL_AED,
  MIN_TOTAL_AED,
  RESULT_PROMISE_MINUTES,
} from "@/lib/constants";
import { isExtractionConfigured } from "@/lib/env";
import { absoluteLink, checkClient } from "@/lib/api/v1/guard";
import { apiData, apiError } from "@/lib/api/v1/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Bumped only for a change an installed app could not survive. */
const API_VERSION = 1;

/**
 * GET /api/v1/config - everything the website hands its pages as server props,
 * as one document an app can fetch at launch.
 *
 * Nothing here is new data. Areas come from getPublicAreas() (the same
 * four-column projection the wizard is rendered with), the promotion from
 * currentUploadPromotion(), the limits from lib/constants.ts - so an admin
 * switching an area off, or somebody editing the promotion, reaches the apps
 * and the website together.
 *
 * It is also where an app learns it is too old. That is why this route, and
 * only this one, still answers a build below the platform minimum: it says
 * `updateRequired: true` instead of refusing, so the app can show an update
 * screen rather than a failure it cannot explain.
 */
export async function GET(request: Request) {
  const check = checkClient(request, { allowOutdated: true });
  if (!check.ok) return check.response;

  let areas: Awaited<ReturnType<typeof getPublicAreas>>;
  try {
    areas = await getPublicAreas();
  } catch (error) {
    console.error("[v1/config] could not load areas", {
      message: error instanceof Error ? error.message : String(error),
    });
    return apiError("service_unavailable", "Please try again in a moment.", 503);
  }

  return apiData(
    {
      apiVersion: API_VERSION,
      client: {
        platform: check.client.platform,
        appVersion: check.client.appVersion,
        minimumVersion: check.minimumVersion,
        updateRequired: check.updateRequired,
      },
      areas,
      promotion: currentUploadPromotion(),
      comparisonApp: COMPARISON_APP,
      currency: CURRENCY,
      resultPromiseMinutes: RESULT_PROMISE_MINUTES,
      foodApps: FOOD_APPS.map((app) => ({
        name: app.name,
        url: app.href,
        logoUrl: absoluteLink(app.logo, request),
      })),
      dialCodes: DIAL_CODES.map(({ code, label, iso }) => ({ code, label, iso })),
      defaultDialCode: DEFAULT_DIAL_CODE,
      limits: {
        maxImageBytes: MAX_IMAGE_BYTES,
        acceptedImageTypes: [...ACCEPTED_IMAGE_TYPES],
        // What the website shrinks an upload to before sending. A guide, not a
        // rule: the server accepts anything under maxImageBytes.
        imageMaxDimension: IMAGE_MAX_DIMENSION,
        maxCartItems: MAX_CART_ITEMS,
        maxItemNameLength: MAX_ITEM_NAME_LENGTH,
        maxItemQuantity: MAX_ITEM_QUANTITY,
        maxRestaurantNameLength: MAX_RESTAURANT_NAME_LENGTH,
        minTotal: MIN_TOTAL_AED,
        maxTotal: MAX_TOTAL_AED,
      },
      features: {
        // Whether POST /api/extract will read a screenshot. When false the app
        // opens the confirm step empty, as the website does.
        screenshotReading: isExtractionConfigured(),
      },
      links: {
        privacy: absoluteLink("/privacy", request),
      },
    },
    // Private: the client block depends on the caller's header. A minute is
    // short enough that an area switched off stops being offered promptly.
    { headers: { "Cache-Control": "private, max-age=60" } },
  );
}
