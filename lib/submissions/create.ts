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
import { generateReferenceNumber, generateResultToken } from "@/lib/utils/reference";
import { alertAdminOfNewSubmission } from "@/lib/notifications/admin-alert";
import { pushToAdmins } from "@/lib/push/send";
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
  | { ok: true; referenceNumber: string; resultToken: string; id: string }
  | { ok: false; status: number; error: string; field?: string };

const GENERIC_FAILURE = "We couldn't submit your order. Please try again.";
const MAX_REFERENCE_ATTEMPTS = 5;

/** The shape supabase-js hands back on a failed query. */
type DbError = { message: string; code?: string; details?: string; hint?: string } | null;

/**
 * What to put in a log line about a failed query.
 *
 * Postgres already says exactly what was wrong - a missing column, a violated
 * constraint - and that sentence is the difference between a fix and an
 * afternoon. None of it is customer data: these fields describe the schema and
 * the statement, never the values, which is why they are safe to log when the
 * row itself is not.
 */
function describeDbError(error: DbError) {
  return {
    message: error?.message ?? "no error message",
    code: error?.code,
    details: error?.details,
    hint: error?.hint,
  };
}

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
    .select("id, active, name")
    .eq("id", fields.areaId)
    .maybeSingle<{ id: string; active: boolean; name: string | null }>();

  if (areaError) {
    console.error("[submissions] could not read the area", describeDbError(areaError));
    return { ok: false, status: 500, error: GENERIC_FAILURE };
  }
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
    console.error("[submissions] could not store the cart screenshot", {
      bucket: STORAGE_BUCKET,
      message: cartUpload.error.message,
    });
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
  const resultToken = generateResultToken();
  let inserted = false;
  let insertError: DbError = null;

  for (let attempt = 0; attempt < MAX_REFERENCE_ATTEMPTS; attempt += 1) {
    referenceNumber = generateReferenceNumber();

    const { error } = await supabase.from("submissions").insert({
      id: submissionId,
      reference_number: referenceNumber,
      // Generated here rather than left to the column default, because the
      // customer is sent straight to this address and we cannot wait to read it
      // back. The default exists so a row can never end up without one.
      result_token: resultToken,
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

    insertError = error;

    // 23505 = unique violation; retry with a different reference suffix.
    if (error.code !== "23505") break;
  }

  if (!inserted) {
    // The most common cause by far is a migration that was never run, and the
    // Postgres error says which column is missing - so log it rather than make
    // somebody reproduce the failure to find out. The row's values are not
    // logged, only what the database objected to.
    console.error("[submissions] could not insert the submission", {
      ...describeDbError(insertError),
      hint: "A missing column here usually means a migration has not been run.",
    });

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

  // ---- 6. Tell somebody ---------------------------------------------------
  // Last, and unable to fail the submission: the row is written and the
  // customer's result page exists whatever happens here. Without it nobody
  // knows to go and do the comparison, which is the whole job.
  try {
    await alertAdminOfNewSubmission({
      reference: referenceNumber,
      restaurantName: fields.restaurantName,
      areaName: area.name,
      currentTotal: formatMinorToDecimalString(currentTotalMinor),
      hasCheckoutImage: checkoutPath !== null,
      itemCount: itemsStored,
    });
  } catch {
    // Already swallowed inside, and swallowed again here on principle.
  }

  // The same news, on the phone in their pocket. An addition to the Telegram
  // and email alerts rather than a replacement: this one survives the browser
  // being closed, those survive the browser not having permission.
  //
  // The area is the only detail carried. It is enough to judge whether this is
  // worth getting up for, and a notification is rendered on a lock screen -
  // so the restaurant, the total and anything about the customer stay out.
  await pushToAdmins({
    title: "New SnipSavor request 🔔",
    body: area.name
      ? `A customer in ${area.name} just submitted a price comparison.`
      : "A customer just submitted a price comparison.",
    url: `/admin/submissions/${submissionId}`,
    tag: `submission-${submissionId}`,
  });

  return { ok: true, referenceNumber, resultToken, id: submissionId };
}
