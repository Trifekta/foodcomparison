/**
 * Product-wide constants. Business decisions live here so they are changed in one
 * place rather than being scattered through UI components.
 */

/**
 * The wordmark is "FindFoodae" set as FindFood + ae, where "ae" is the UAE
 * country code rendered as "UAE". Keep the two halves separate so the lockup
 * can be styled consistently wherever it appears.
 */
export const BRAND_NAME = "FindFoodae";
export const PRODUCT_NAME = "FindFoodae";
export const WORDMARK_PRIMARY = "FindFood";
export const WORDMARK_SUFFIX = "UAE";

/** Phase 1 launches in Dubai only. */
export const LAUNCH_CITY = "Dubai";
export const LAUNCH_EMIRATE = "Dubai";

/** The platform we currently compare every basket against. */
export const COMPARISON_APP = "Keeta";

/**
 * Apps a customer can be ordering *from*. Keeta is deliberately absent: Phase 1
 * compares other apps against Keeta. The database stores free text, so adding
 * Keeta (or another app) here later needs no migration.
 */
export const SOURCE_APPS = [
  "Talabat",
  "Careem Food",
  "Deliveroo",
  "Noon Food",
  "Other",
] as const;

export type SourceApp = (typeof SOURCE_APPS)[number];

export const OTHER_APP_VALUE: SourceApp = "Other";

/** Image upload rules, enforced on the client *and* on the server. */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export const ACCEPTED_IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp"] as const;

/** Client-side downscale target. Keeps screenshots readable but uploads small. */
export const IMAGE_MAX_DIMENSION = 1600;
export const IMAGE_COMPRESSION_QUALITY = 0.85;

/**
 * The basket the customer confirms after uploading. The restaurant is required
 * because an admin cannot rebuild an order without knowing where it is from;
 * the item list is optional, since the cart screenshot remains the source of
 * truth and we never read items out of it automatically.
 */
export const MAX_RESTAURANT_NAME_LENGTH = 120;
export const MAX_CART_ITEMS = 20;
export const MAX_ITEM_NAME_LENGTH = 120;
export const MAX_ITEM_QUANTITY = 99;

/** Money limits for the checkout total the customer types in. */
export const MIN_TOTAL_AED = 0.01;
export const MAX_TOTAL_AED = 5000;
export const CURRENCY = "AED";

/**
 * How long uploaded screenshots should be kept. Deletion is not automated in the
 * MVP — see README ("Screenshot retention") for the scheduled job that uses this.
 */
export const SCREENSHOT_RETENTION_DAYS = 30;

/** Private Supabase Storage bucket holding customer screenshots. */
export const STORAGE_BUCKET = "submission-images";

/** How long an admin's signed screenshot URL stays valid. */
export const SIGNED_URL_TTL_SECONDS = 60 * 10;

/** Default country for WhatsApp contact (Dubai/UAE launch). */
export const DEFAULT_DIAL_CODE = "+971";

export const DIAL_CODES = [
  { code: "+971", label: "UAE +971", iso: "AE" },
  { code: "+966", label: "KSA +966", iso: "SA" },
  { code: "+965", label: "Kuwait +965", iso: "KW" },
  { code: "+973", label: "Bahrain +973", iso: "BH" },
  { code: "+974", label: "Qatar +974", iso: "QA" },
  { code: "+968", label: "Oman +968", iso: "OM" },
  { code: "+44", label: "UK +44", iso: "GB" },
  { code: "+91", label: "India +91", iso: "IN" },
] as const;

/** Best-effort rate limit on the public submission endpoint. */
export const RATE_LIMIT_MAX_SUBMISSIONS = 5;
export const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
