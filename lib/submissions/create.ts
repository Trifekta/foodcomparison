import "server-only";

import { randomUUID } from "node:crypto";
import { COMPARISON_APP, OTHER_APP_VALUE, STORAGE_BUCKET } from "@/lib/constants";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateImageFile, type ImageValidationSuccess } from "@/lib/validation/image";
import { submissionFieldsSchema } from "@/lib/validation/submission";
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

export async function createSubmission(formData: FormData): Promise<CreateSubmissionResult> {
  // ---- 1. Fields ----------------------------------------------------------
  const parsed = submissionFieldsSchema.safeParse({
    areaId: String(formData.get("areaId") ?? ""),
    sourceApp: String(formData.get("sourceApp") ?? ""),
    sourceAppOther: String(formData.get("sourceAppOther") ?? ""),
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
  const submissionId = randomUUID();
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
      source_app: fields.sourceApp,
      source_app_other:
        fields.sourceApp === OTHER_APP_VALUE ? sanitiseText(fields.sourceAppOther, 80) : null,
      area_id: area.id,
      current_total: formatMinorToDecimalString(currentTotalMinor),
      comparison_app: COMPARISON_APP,
      cart_image_path: cartPath,
      checkout_image_path: checkoutPath,
      contact_type: fields.contactType,
      whatsapp_number: whatsappNumber,
      email,
      marketing_consent: fields.marketingConsent,
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

  await supabase.from("submission_events").insert({
    submission_id: submissionId,
    event_type: "submission_created",
    new_status: "new",
    metadata: { source_app: fields.sourceApp, has_checkout_image: checkoutPath !== null },
  });

  return { ok: true, referenceNumber, id: submissionId };
}
