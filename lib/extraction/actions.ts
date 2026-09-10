"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { STORAGE_BUCKET } from "@/lib/constants";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/supabase/auth";
import { OCR_MAX_TEXT_LENGTH } from "@/lib/ocr/config";
import { parseAmountToMinor } from "@/lib/calculations/money";
import { validateImageFile } from "@/lib/validation/image";
import { structureImage, structureOcrText } from "./structure";
import { normaliseBasket } from "./normalise";
import { structuredBasketSchema, type ExtractionRun, type StructuredBasket } from "./schema";

/**
 * Admin-assisted extraction.
 *
 * Three actions, in the order an admin uses them:
 *
 *   extractFromOcrText  - the normal route. The admin's browser has already
 *                         done the OCR; only the text arrives here.
 *   extractWithVision   - the fallback. Sends the screenshot itself, and only
 *                         because an admin pressed the button that says so.
 *   confirmExtraction   - writes the basket the admin reviewed and edited.
 *
 * Every one re-checks the caller with requireAdmin() and writes through the
 * session-scoped client, so RLS remains the final authority. Nothing an
 * extraction produces is saved to the submission until confirmExtraction runs.
 */

export interface ExtractionActionResult {
  ok: boolean;
  extractionId?: string;
  basket?: StructuredBasket;
  ocrText?: string | null;
  message?: string;
}

/** Records the run whether it worked or not - a failure is data too. */
async function recordRun(
  submissionId: string,
  actorId: string,
  run: ExtractionRun,
): Promise<string | null> {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("submission_extractions")
    .insert({
      submission_id: submissionId,
      method: run.method,
      status: "ok",
      ocr_text: run.ocrText,
      ocr_confidence: run.ocrConfidence,
      ocr_engine: run.ocrEngine,
      ocr_ms: run.ocrMs,
      model: run.model,
      prompt_version: run.promptVersion,
      llm_ms: run.llmMs,
      structured: run.basket,
      uncertain_fields: run.basket.uncertain_fields,
      created_by: actorId,
    })
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error || !data) return null;
  return data.id;
}

async function recordFailure(
  submissionId: string,
  actorId: string,
  method: "ocr_llm" | "vision",
  detail: string,
  ocrText: string | null = null,
): Promise<void> {
  const supabase = await createServerSupabaseClient();
  await supabase.from("submission_extractions").insert({
    submission_id: submissionId,
    method,
    status: "failed",
    error: detail,
    ocr_text: ocrText,
    created_by: actorId,
  });
}

const ocrInputSchema = z.object({
  submissionId: z.uuid(),
  text: z.string().min(1).max(OCR_MAX_TEXT_LENGTH * 2),
  confidence: z.number().min(0).max(100),
  engine: z.string().max(120),
  durationMs: z.number().int().min(0).max(600_000),
});

/**
 * The default route: structure text the admin's browser produced.
 *
 * The screenshot is not touched here and never reaches the model. What arrives
 * is whatever the browser says the OCR said - unverifiable, but an admin is the
 * only one who can call this and they review the result anyway.
 */
export async function extractFromOcrText(input: unknown): Promise<ExtractionActionResult> {
  const session = await requireAdmin();

  const parsed = ocrInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "That OCR result could not be read." };

  const { submissionId, text, confidence, engine, durationMs } = parsed.data;

  const outcome = await structureOcrText(
    { text, confidence, engine, durationMs },
    undefined,
  );

  if (!outcome.ok) {
    const message =
      outcome.reason === "not_configured"
        ? "No ANTHROPIC_API_KEY is configured, so extraction is switched off."
        : (outcome.detail ?? "The text could not be structured.");

    if (outcome.reason !== "not_configured") {
      await recordFailure(submissionId, session.user.id, "ocr_llm", message, text);
    }
    return { ok: false, message };
  }

  const extractionId = await recordRun(submissionId, session.user.id, outcome.run);
  if (!extractionId) return { ok: false, message: "The extraction could not be saved." };

  revalidatePath(`/admin/submissions/${submissionId}`);
  return {
    ok: true,
    extractionId,
    basket: outcome.run.basket,
    ocrText: outcome.run.ocrText,
  };
}

/**
 * The fallback: send the screenshot itself to the model.
 *
 * Deliberately a separate action with a separate button. It is never called
 * automatically, never as a retry after a poor OCR read, and never from the
 * customer path - an admin has to decide that the OCR route has failed and that
 * sending the image is worth it.
 */
export async function extractWithVision(submissionId: string): Promise<ExtractionActionResult> {
  const session = await requireAdmin();

  if (!z.uuid().safeParse(submissionId).success) {
    return { ok: false, message: "Unknown submission." };
  }

  const supabase = await createServerSupabaseClient();

  const { data: submission } = await supabase
    .from("submissions")
    .select("cart_image_path")
    .eq("id", submissionId)
    .maybeSingle<{ cart_image_path: string }>();

  if (!submission?.cart_image_path) {
    return { ok: false, message: "That submission has no cart screenshot." };
  }

  const { data: blob, error: downloadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .download(submission.cart_image_path);

  if (downloadError || !blob) {
    return { ok: false, message: "The screenshot could not be opened." };
  }

  // Same magic-byte check the upload path applies, so a stored file that is not
  // what it claims never reaches the model.
  const image = await validateImageFile(
    new File([blob], "cart", { type: blob.type || "image/png" }),
    "cart screenshot",
  );
  if (!image.ok) return { ok: false, message: image.error };

  const outcome = await structureImage(image);

  if (!outcome.ok) {
    const message =
      outcome.reason === "not_configured"
        ? "No ANTHROPIC_API_KEY is configured, so extraction is switched off."
        : (outcome.detail ?? "The screenshot could not be read.");

    if (outcome.reason !== "not_configured") {
      await recordFailure(submissionId, session.user.id, "vision", message);
    }
    return { ok: false, message };
  }

  const extractionId = await recordRun(submissionId, session.user.id, outcome.run);
  if (!extractionId) return { ok: false, message: "The extraction could not be saved." };

  revalidatePath(`/admin/submissions/${submissionId}`);
  return { ok: true, extractionId, basket: outcome.run.basket, ocrText: null };
}

const confirmInputSchema = z.object({
  submissionId: z.uuid(),
  extractionId: z.uuid(),
  basket: structuredBasketSchema,
});

/**
 * Saves the basket the admin reviewed.
 *
 * This is the only place an extraction becomes part of the submission, and it
 * runs only on an explicit confirmation. Customer-entered values are never
 * touched: submissions.restaurant_name and current_total are what the customer
 * said, and stay that way. Items the customer entered themselves are left
 * alone; only previously extracted rows are replaced, so confirming twice does
 * not duplicate and does not discard anything a person typed.
 */
export async function confirmExtraction(input: unknown): Promise<ExtractionActionResult> {
  const session = await requireAdmin();

  const parsed = confirmInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "That basket could not be saved." };

  const { submissionId, extractionId, basket } = parsed.data;
  const clean = normaliseBasket(basket);
  const supabase = await createServerSupabaseClient();

  // The extraction must belong to this submission. RLS already restricts the
  // caller to an admin; this stops one submission's basket landing on another.
  const { data: extraction } = await supabase
    .from("submission_extractions")
    .select("id, submission_id")
    .eq("id", extractionId)
    .maybeSingle<{ id: string; submission_id: string }>();

  if (!extraction || extraction.submission_id !== submissionId) {
    return { ok: false, message: "That extraction does not belong to this submission." };
  }

  // Replace only what a previous extraction put here.
  const { error: clearError } = await supabase
    .from("submission_items")
    .delete()
    .eq("submission_id", submissionId)
    .in("source", ["extracted", "edited"]);

  if (clearError) return { ok: false, message: "The previous extraction could not be replaced." };

  if (clean.items.length > 0) {
    const { count } = await supabase
      .from("submission_items")
      .select("id", { count: "exact", head: true })
      .eq("submission_id", submissionId);

    const rows = clean.items.map((item, index) => ({
      submission_id: submissionId,
      extraction_id: extractionId,
      name: [item.name, ...item.modifiers].join(" · ").slice(0, 120),
      quantity: item.quantity,
      line_price_minor: parseAmountToMinor(item.line_total || null),
      source: "extracted" as const,
      sort_order: (count ?? 0) + index,
    }));

    const { error } = await supabase.from("submission_items").insert(rows);
    if (error) return { ok: false, message: "The basket could not be saved." };
  }

  const { error: confirmError } = await supabase
    .from("submission_extractions")
    .update({
      confirmed: clean,
      confirmed_at: new Date().toISOString(),
      confirmed_by: session.user.id,
    })
    .eq("id", extractionId);

  if (confirmError) return { ok: false, message: "The confirmation could not be recorded." };

  revalidatePath(`/admin/submissions/${submissionId}`);
  return { ok: true, extractionId, basket: clean };
}
