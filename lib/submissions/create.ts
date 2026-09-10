import "server-only";

import {
  COMPARISON_APP,
  MAX_ITEM_NAME_LENGTH,
  MAX_RESTAURANT_NAME_LENGTH,
  STORAGE_BUCKET,
  UNKNOWN_SOURCE_APP,
} from "@/lib/constants";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateImageFile, type ImageValidationSuccess } from "@/lib/validation/image";
import {
  ERROR_MESSAGES,
  cartItemsSchema,
  submissionFieldsSchema,
} from "@/lib/validation/submission";
import { generateReferenceNumber } from "@/lib/utils/reference";
import { normalisePhone } from "@/lib/utils/phone";
import { sanitiseText } from "@/lib/utils/text";
import { formatMinorToDecimalString, parseAmountToMinor } from "@/lib/calculations/money";

/**
 * Creates a submission from the public wizard.
 *
 * This is the only path customer data takes into the database. It runs with the
 * service role because the customer is anonymous and the storage bucket is
 * private - which is exactly why every value is re-validated here rather than
 * trusted from the browser.
 */

export type CreateSubmissionResult =
  | { ok: true; referenceNumber: string; id: string }
  | { ok: false; status: number; error: string; field?: string };

const GENERIC_FAILURE = "We couldn't submit your order. Please try again.";
const MAX_REFERENCE_ATTEMPTS = 5;

interface StoredItem {
  name: string;
  quantity: number;
  linePriceMinor: number | null;
  source: "customer" | "extracted" | "edited";
}

type ParsedItems = { ok: true; value: StoredItem[] } | { ok: false; error: string };

/** Reads the optional `items` JSON entry. Absent is fine; malformed is not. */
function parseItems(raw: FormDataEntryValue | null): ParsedItems {
  if (typeof raw !== "string" || raw.trim() === "") return { ok: true, value: [] };

  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    return { ok: false, error: ERROR_MESSAGES.itemsInvalid };
  }

  const parsed = cartItemsSchema.safeParse(decoded);
  if (!parsed.success) return { ok: false, error: ERROR_MESSAGES.itemsInvalid };

  // Names are re-cleaned here: the schema bounds them, sanitiseText strips
  // control characters. A name that sanitises away entirely is dropped.
  const value = parsed.data.flatMap<StoredItem>((item) => {
    const name = sanitiseText(item.name, MAX_ITEM_NAME_LENGTH);
    if (!name) return [];

    // The price is re-parsed here rather than trusted as a string: it reaches
    // the database as an integer, and a malformed one drops the price, not the
    // item.
    let linePriceMinor: number | null = null;
    if (item.linePrice !== null) {
      try {
        const minor = parseAmountToMinor(item.linePrice);
        if (minor !== null && minor > 0) linePriceMinor = minor;
      } catch {
        linePriceMinor = null;
      }
    }

    return [{ name, quantity: item.quantity, linePriceMinor, source: item.source }];
  });

  return { ok: true, value };
}

export async function createSubmission(formData: FormData): Promise<CreateSubmissionResult> {
  // ---- 1. Fields ----------------------------------------------------------
  const parsed = submissionFieldsSchema.safeParse({
    restaurantName: String(formData.get("restaurantName") ?? ""),
    areaId: String(formData.get("areaId") ?? ""),
    currentTotal: String(formData.get("currentTotal") ?? ""),
    contactType: String(formData.get("contactType") ?? ""),
    dialCode: String(formData.get("dialCode") ?? ""),
    whatsappNumber: String(formData.get("whatsappNumber") ?? ""),
    email: String(formData.get("email") ?? ""),
    marketingConsent: formData.get("marketingConsent") === "true",
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      status: 400,
      error: issue?.message ?? "Please check your answers and try again.",
      field: issue?.path[0] ? String(issue.path[0]) : undefined,
    };
  }
  const fields = parsed.data;

  // The optional item list arrives as one JSON entry. Bad JSON is rejected
  // rather than ignored: it can only come from a tampered or broken client, and
  // silently dropping a basket the customer thinks they sent would be worse.
  const items = parseItems(formData.get("items"));
  if (!items.ok) {
    return { ok: false, status: 400, error: items.error, field: "items" };
  }

  // ---- 2. Images (magic-byte checked, never trusted by extension) ---------
  const cartFile = formData.get("cartImage");
  if (!(cartFile instanceof File)) {
    return {
      ok: false,
      status: 400,
      error: "Please upload a screenshot of your cart.",
      field: "cartImage",
    };
  }

  const cartImage = await validateImageFile(cartFile, "cart screenshot");
  if (!cartImage.ok) {
    return { ok: false, status: 400, error: cartImage.error, field: "cartImage" };
  }

  const checkoutCandidate = formData.get("checkoutImage");
  let checkoutImage: ImageValidationSuccess | null = null;
  if (checkoutCandidate instanceof File && checkoutCandidate.size > 0) {
    const validated = await validateImageFile(checkoutCandidate, "checkout screenshot");
    if (!validated.ok) {
      return { ok: false, status: 400, error: validated.error, field: "checkoutImage" };
    }
    checkoutImage = validated;
  }

  // ---- 3. Derived values --------------------------------------------------
  const currentTotalMinor = parseAmountToMinor(fields.currentTotal);
  if (currentTotalMinor === null) {
    return {
      ok: false,
      status: 400,
      error: "Enter the final amount you would pay.",
      field: "currentTotal",
    };
  }

  let whatsappNumber: string | null = null;
  let email: string | null = null;

  if (fields.contactType === "whatsapp") {
    try {
      whatsappNumber = normalisePhone(fields.dialCode, fields.whatsappNumber).e164;
    } catch {
      return {
        ok: false,
        status: 400,
        error: "Enter a valid mobile number.",
        field: "whatsappNumber",
      };
    }
  } else {
    email = fields.email.trim().toLowerCase();
  }

  const supabase = createAdminClient();

  // The area must exist and still be active - a stale or tampered id is rejected.
  const { data: area, error: areaError } = await supabase
    .from("areas")
    .select("id, active")
    .eq("id", fields.areaId)
    .maybeSingle<{ id: string; active: boolean }>();

  if (areaError) return { ok: false, status: 500, error: GENERIC_FAILURE };
  if (!area?.active) {
    return { ok: false, status: 400, error: "Please select your Dubai area.", field: "areaId" };
  }

  // ---- 4. Upload first, using an id we mint ourselves ---------------------
  // Uploading before the insert means the row is never written with a
  // placeholder path, and a failed insert leaves only orphaned objects, which
  // we clean up below.
  // Web Crypto global: works on Node and on Cloudflare Workers alike.
  const submissionId = crypto.randomUUID();
  const uploadedPaths: string[] = [];

  const cartPath = `submissions/${submissionId}/cart.${cartImage.extension}`;
  const cartUpload = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(cartPath, cartImage.bytes, { contentType: cartImage.mimeType, upsert: true });

  if (cartUpload.error) {
    return { ok: false, status: 500, error: "We couldn't upload your screenshot. Please try again." };
  }
  uploadedPaths.push(cartPath);

  let checkoutPath: string | null = null;
  if (checkoutImage) {
    const path = `submissions/${submissionId}/checkout.${checkoutImage.extension}`;
    const upload = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, checkoutImage.bytes, {
        contentType: checkoutImage.mimeType,
        upsert: true,
      });

    // The checkout screenshot is optional: a failed upload must never cost the
    // customer their submission, so we continue without it.
    if (!upload.error) {
      checkoutPath = path;
      uploadedPaths.push(path);
    }
  }

  // ---- 5. Insert, retrying only on a reference-number collision ------------
  let referenceNumber = "";
  let inserted = false;

  for (let attempt = 0; attempt < MAX_REFERENCE_ATTEMPTS; attempt += 1) {
    referenceNumber = generateReferenceNumber();

    const { error } = await supabase.from("submissions").insert({
      id: submissionId,
      reference_number: referenceNumber,
      status: "new",
      // The customer is not asked which app this came from - the screenshot
      // shows it to anyone who looks, and asking costs a question. The admin
      // sets it while rebuilding the basket; until then it is unknown.
      source_app: UNKNOWN_SOURCE_APP,
      source_app_other: null,
      area_id: area.id,
      current_total: formatMinorToDecimalString(currentTotalMinor),
      comparison_app: COMPARISON_APP,
      cart_image_path: cartPath,
      checkout_image_path: checkoutPath,
      contact_type: fields.contactType,
      whatsapp_number: whatsappNumber,
      email,
      marketing_consent: fields.marketingConsent,
      restaurant_name: sanitiseText(fields.restaurantName, MAX_RESTAURANT_NAME_LENGTH),
    });

    if (!error) {
      inserted = true;
      break;
    }

    // 23505 = unique violation; retry with a different reference suffix.
    if (error.code !== "23505") break;
  }

  if (!inserted) {
    await supabase.storage.from(STORAGE_BUCKET).remove(uploadedPaths);
    return { ok: false, status: 500, error: GENERIC_FAILURE };
  }

  // Items are a convenience for the admin, not part of the comparison itself.
  // A failed insert must not cost the customer their submission - the cart
  // screenshot still carries everything - so the outcome is only recorded.
  let itemsStored = 0;
  if (items.value.length > 0) {
    const rows = items.value.map((item, index) => ({
      submission_id: submissionId,
      name: item.name,
      quantity: item.quantity,
      line_price_minor: item.linePriceMinor,
      source: item.source,
      sort_order: index,
    }));

    const { error } = await supabase.from("submission_items").insert(rows);
    if (!error) itemsStored = rows.length;
  }

  await supabase.from("submission_events").insert({
    submission_id: submissionId,
    event_type: "submission_created",
    new_status: "new",
    metadata: {
      has_checkout_image: checkoutPath !== null,
      item_count: itemsStored,
      extracted_item_count: items.value.filter((item) => item.source !== "customer").length,
    },
  });

  return { ok: true, referenceNumber, id: submissionId };
}
