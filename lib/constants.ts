/**
 * Product-wide constants. Business decisions live here so they are changed in one
 * place rather than being scattered through UI components.
 */

/**
 * The wordmark is "SnipSavor", set as two halves: "Snip" plain and "Savor"
 * carrying the golden rule.
 *
 * The halves are named rather than sliced out of the whole. The lockup used to
 * cut the brand name at the fourth character, which worked only for the one
 * name it was written for - and a brand name is exactly the kind of thing that
 * changes. Spelling the two parts out means the next change is this file alone.
 *
 * BRAND_NAME must stay the concatenation of the two: it is the accessible name
 * of the lockup, so a mismatch is a screen reader saying something the screen
 * does not.
 */
export const BRAND_NAME = "SnipSavor";
export const PRODUCT_NAME = "SnipSavor";
export const WORDMARK_PRIMARY = "Snip";
export const WORDMARK_ACCENT = "Savor";

/**
 * How long a customer is told to expect to wait.
 *
 * The number lives here because it appears on four screens - the landing page,
 * the upload step, the submit button and the waiting page - and a promise that
 * says five minutes in one place and ten in another is worse than no promise.
 *
 * It exists at all because the product only works before somebody orders. A
 * person deciding whether to wait needs to know whether it is five minutes or
 * an hour, and with nothing on the screen they assume the worst and order
 * anyway. This is the cheapest conversion there is.
 */
export const RESULT_PROMISE_MINUTES = 5;
export const RESULT_PROMISE = `under ${RESULT_PROMISE_MINUTES} minutes`;

/** Phase 1 launches in Dubai only. */
export const LAUNCH_CITY = "Dubai";
export const LAUNCH_EMIRATE = "Dubai";

/** The platform we currently compare every basket against. */
export const COMPARISON_APP = "Keeta";

/**
 * Apps an order can have come *from*. Keeta is deliberately absent: Phase 1
 * compares other apps against Keeta. The database stores free text, so adding
 * Keeta (or another app) here later needs no migration.
 *
 * The customer is not asked this. None of the real screenshots we have carry
 * the app's name in their text, so it cannot be read out of one - but a person
 * looking at the screenshot knows the app at a glance, so the admin sets it
 * while they are rebuilding the basket. Until they do it stays UNKNOWN.
 */
export const SOURCE_APPS = [
  "Talabat",
  "Careem Food",
  "Deliveroo",
  "Noon Food",
] as const;

export type SourceApp = (typeof SOURCE_APPS)[number];

/**
 * Stored when nobody has said which app an order came from.
 *
 * A real value rather than null: source_app is NOT NULL in the schema, and
 * "not identified yet" is a truthful thing for a submission to say.
 */
export const UNKNOWN_SOURCE_APP = "Unknown";

/** Every value the admin can pick, unknown included. */
export const ADMIN_SOURCE_APPS = [...SOURCE_APPS, UNKNOWN_SOURCE_APP] as const;

/**
 * Kept for rows created before the customer stopped being asked, which may
 * hold "Other" plus a free-text name in source_app_other.
 */
export const LEGACY_OTHER_APP = "Other";

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

/**
 * Screenshot reading.
 *
 * A vision model reads the uploaded cart screenshot and proposes a restaurant,
 * items and prices for the customer to confirm. Nothing it returns is trusted:
 * every value lands in an editable field, and the customer's confirmed version
 * is what we store.
 */
/** Hard ceiling on how long a customer waits for the read before we give up. */
export const EXTRACTION_TIMEOUT_MS = 45_000;
/** The extraction endpoint calls a paid API, so it gets its own tighter limit. */
export const RATE_LIMIT_MAX_EXTRACTIONS = 12;

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

/**
 * How often one browser may ask whether its result is ready.
 *
 * Far looser than the submission limit, because this is a page left open while
 * somebody waits for an answer, not an upload. It still has a ceiling: the
 * token is unguessable, so the only thing this protects against is a tab that
 * has lost its mind.
 */
export const RATE_LIMIT_MAX_RESULT_CHECKS = 120;
export const RATE_LIMIT_RESULT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
