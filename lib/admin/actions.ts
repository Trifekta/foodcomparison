"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getAdminSession, requireAdmin } from "@/lib/supabase/auth";
import {
  areaInputSchema,
  comparisonInputSchema,
  unavailableInputSchema,
} from "@/lib/validation/admin";
import { calculateSavingFromStrings, toPersistableSaving } from "@/lib/calculations/saving";
import {
  buildResultMessage,
  buildResultSubject,
  buildUnavailableMessage,
  sourceAppLabel,
} from "@/lib/notifications/messages";
import { alertChannels, sendTestAdminAlert } from "@/lib/notifications/admin-alert";
import { getEmailProvider } from "@/lib/notifications/resend";
import { sanitiseMultiline, sanitiseText } from "@/lib/utils/text";
import { absoluteUrl } from "@/lib/env";
import { resultPath } from "@/lib/utils/reference";
import { formatMinorToDecimalString, parseAmountToMinor } from "@/lib/calculations/money";
import type { SubmissionRow, SubmissionStatus } from "@/types/database";

/**
 * Admin writes.
 *
 * Every action re-checks the caller with requireAdmin() and then writes through
 * the session-scoped client, so RLS is the final authority. Each state change
 * also appends a submission_events row, which is the audit trail.
 */

export interface ActionResult {
  ok: boolean;
  message?: string;
}

/**
 * Reports what actually went wrong, instead of taking the page down.
 *
 * A server action that throws reaches the browser as the error boundary and a
 * digest - Next redacts the message in production, so the one useful sentence
 * exists only in the logs. For an admin, who can act on it, that is exactly
 * backwards: show it.
 *
 * Next signals redirects and not-found by throwing too, so those are rethrown
 * untouched; swallowing a redirect would silently break signing out.
 */
function isNextControlFlow(error: unknown): boolean {
  const digest = (error as { digest?: unknown } | null)?.digest;
  return typeof digest === "string" && digest.startsWith("NEXT_");
}

async function reported(run: () => Promise<ActionResult>): Promise<ActionResult> {
  try {
    return await run();
  } catch (error) {
    if (isNextControlFlow(error)) throw error;
    const detail = error instanceof Error ? error.message : String(error);
    return { ok: false, message: `That failed: ${detail}` };
  }
}


/**
 * Covers both reasons the load can come back empty - the row is gone, or the
 * query named something the database does not have - because the admin's next
 * step is the same either way, and the dashboard names the missing migration.
 */
const LOAD_FAILED =
  "Could not load this submission. If this keeps happening, open the dashboard - it will say if a migration is missing.";

async function recordEvent(input: {
  submissionId: string;
  eventType:
    | "review_started"
    | "comparison_added"
    | "status_changed"
    | "result_generated"
    | "result_sent";
  previousStatus?: SubmissionStatus | null;
  newStatus?: SubmissionStatus | null;
  metadata?: Record<string, unknown>;
  actorId: string;
}): Promise<void> {
  const supabase = await createServerSupabaseClient();
  await supabase.from("submission_events").insert({
    submission_id: input.submissionId,
    event_type: input.eventType,
    previous_status: input.previousStatus ?? null,
    new_status: input.newStatus ?? null,
    metadata: input.metadata ?? null,
    created_by: input.actorId,
  });
}

async function loadSubmission(id: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("submissions")
    .select(
      "id, status, source_app, source_app_other, current_total, comparison_total, comparison_app, contact_type, whatsapp_number, email, reference_number, restaurant_name, result_message, result_token",
    )
    .eq("id", id)
    .maybeSingle<
      Pick<
        SubmissionRow,
        | "id"
        | "status"
        | "source_app"
        | "source_app_other"
        | "restaurant_name"
        | "result_token"
        | "current_total"
        | "comparison_total"
        | "comparison_app"
        | "contact_type"
        | "whatsapp_number"
        | "email"
        | "reference_number"
        | "result_message"
      >
    >();

  // Thrown, so the message survives: every action runs inside reported(), which
  // turns it into a sentence in the panel rather than an error page.
  if (error) throw new Error(`Could not load the submission: ${error.message}`);
  return data;
}

/** Step 3 of the workflow: new -> reviewing. */
export async function startReview(submissionId: string): Promise<ActionResult> {
  const { user } = await requireAdmin();
  return reported(async () => {
    const supabase = await createServerSupabaseClient();

    const submission = await loadSubmission(submissionId);
    if (!submission) return { ok: false, message: LOAD_FAILED };
    if (submission.status !== "new") {
      return { ok: true, message: "Already under review." };
    }

    const { error } = await supabase
      .from("submissions")
      .update({ status: "reviewing", review_started_at: new Date().toISOString() })
      .eq("id", submissionId);

    if (error) return { ok: false, message: "Could not start the review." };

    await recordEvent({
      submissionId,
      eventType: "review_started",
      previousStatus: submission.status,
      newStatus: "reviewing",
      actorId: user.id,
    });

    revalidatePath(`/admin/submissions/${submissionId}`);
    revalidatePath("/admin");
    return { ok: true };
  });
}

/**
 * Steps 8-11: persist the Keeta total, the derived saving and the internal notes.
 * The maths comes from lib/calculations/saving.ts - it is not recomputed here.
 */
export async function saveComparison(formData: FormData): Promise<ActionResult> {
  const { user } = await requireAdmin();
  return reported(async () => {

    const parsed = comparisonInputSchema.safeParse({
      submissionId: String(formData.get("submissionId") ?? ""),
      comparisonTotal: String(formData.get("comparisonTotal") ?? ""),
      comparisonUrl: String(formData.get("comparisonUrl") ?? ""),
      sourceApp: String(formData.get("sourceApp") ?? "") || undefined,
      restaurantFound: String(formData.get("restaurantFound") ?? ""),
      comparisonLocationNote: String(formData.get("comparisonLocationNote") ?? ""),
      adminNotes: String(formData.get("adminNotes") ?? ""),
    });

    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the values and retry." };
    }

    const submission = await loadSubmission(parsed.data.submissionId);
    if (!submission) return { ok: false, message: LOAD_FAILED };

    const comparisonMinor = parseAmountToMinor(parsed.data.comparisonTotal);
    if (comparisonMinor === null) return { ok: false, message: "Enter the Keeta total." };
    const comparisonTotal = formatMinorToDecimalString(comparisonMinor);

    const saving = calculateSavingFromStrings(submission.current_total, comparisonTotal);
    if (!saving) return { ok: false, message: "Could not calculate the saving." };

    const persisted = toPersistableSaving(saving);
    const nextStatus: SubmissionStatus = saving.hasSaving ? "result_ready" : "no_saving";

    // The app the admin just identified wins over whatever was stored, so the
    // message names it correctly on the very first save.
    const sourceApp = parsed.data.sourceApp ?? submission.source_app;
    const generated = buildResultMessage({
      sourceAppLabel: sourceAppLabel({
        source_app: sourceApp,
        source_app_other: submission.source_app_other,
      }),
      currentTotal: submission.current_total,
      comparisonTotal,
      comparisonAppLabel: submission.comparison_app,
      resultUrl: absoluteUrl(resultPath(submission.result_token)),
    });

    const supabase = await createServerSupabaseClient();
    const { error } = await supabase
      .from("submissions")
      .update({
        source_app: sourceApp,
        comparison_url: parsed.data.comparisonUrl ? parsed.data.comparisonUrl : null,
        comparison_total: comparisonTotal,
        saving_amount: persisted.saving_amount,
        saving_percentage: persisted.saving_percentage,
        restaurant_found: sanitiseText(parsed.data.restaurantFound, 160),
        comparison_location_note: sanitiseText(parsed.data.comparisonLocationNote, 160),
        admin_notes: sanitiseMultiline(parsed.data.adminNotes, 2000),
        result_message: generated.message,
        status: nextStatus,
        completed_at: new Date().toISOString(),
      })
      .eq("id", parsed.data.submissionId);

    if (error) return { ok: false, message: "Could not save the comparison." };

    await recordEvent({
      submissionId: parsed.data.submissionId,
      eventType: "comparison_added",
      previousStatus: submission.status,
      newStatus: nextStatus,
      metadata: {
        comparison_total: comparisonTotal,
        saving_amount: persisted.saving_amount,
        has_saving: saving.hasSaving,
      },
      actorId: user.id,
    });

    await recordEvent({
      submissionId: parsed.data.submissionId,
      eventType: "result_generated",
      newStatus: nextStatus,
      actorId: user.id,
    });

    revalidatePath(`/admin/submissions/${parsed.data.submissionId}`);
    revalidatePath("/admin");
    return { ok: true, message: "Comparison saved." };
  });
}

/**
 * Step 14. Opening WhatsApp is not proof of delivery, so this is always an
 * explicit admin action.
 */
/**
 * Record that this basket cannot be priced on the comparison app.
 *
 * The ending saveComparison cannot express, because it has no total to save.
 * Everything a comparison would have written stays null - no comparison_total,
 * no saving, nothing that could later be mistaken for a price somebody checked
 * - and the customer's message is written the same way the others are, so it
 * reaches them through the same panel and the same send button.
 */
export async function markUnavailable(formData: FormData): Promise<ActionResult> {
  const { user } = await requireAdmin();
  return reported(async () => {

    const parsed = unavailableInputSchema.safeParse({
      submissionId: String(formData.get("submissionId") ?? ""),
      reason: String(formData.get("reason") ?? ""),
      adminNotes: String(formData.get("adminNotes") ?? ""),
    });

    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Pick a reason." };
    }

    const submission = await loadSubmission(parsed.data.submissionId);
    if (!submission) return { ok: false, message: LOAD_FAILED };

    const message = buildUnavailableMessage({
      restaurantName: submission.restaurant_name,
      comparisonAppLabel: submission.comparison_app,
      resultUrl: absoluteUrl(resultPath(submission.result_token)),
    });

    const supabase = await createServerSupabaseClient();
    const { error } = await supabase
      .from("submissions")
      .update({
        status: "unavailable",
        unavailable_reason: parsed.data.reason,
        admin_notes: sanitiseMultiline(parsed.data.adminNotes ?? "", 2000),
        result_message: message,
        completed_at: new Date().toISOString(),
      })
      .eq("id", parsed.data.submissionId);

    if (error) return { ok: false, message: "Could not save the outcome." };

    await recordEvent({
      submissionId: parsed.data.submissionId,
      eventType: "status_changed",
      previousStatus: submission.status,
      newStatus: "unavailable",
      metadata: { unavailable_reason: parsed.data.reason },
      actorId: user.id,
    });

    await recordEvent({
      submissionId: parsed.data.submissionId,
      eventType: "result_generated",
      newStatus: "unavailable",
      actorId: user.id,
    });

    revalidatePath(`/admin/submissions/${parsed.data.submissionId}`);
    revalidatePath("/admin");
    return { ok: true, message: "Recorded — the customer's message is ready below." };
  });
}

export async function markResultSent(submissionId: string): Promise<ActionResult> {
  const { user } = await requireAdmin();
  return reported(async () => {

    const submission = await loadSubmission(submissionId);
    if (!submission) return { ok: false, message: LOAD_FAILED };
    if (!submission.result_message) {
      return { ok: false, message: "Generate the result before marking it sent." };
    }

    const supabase = await createServerSupabaseClient();
    const { error } = await supabase
      .from("submissions")
      .update({ status: "result_sent", result_sent_at: new Date().toISOString() })
      .eq("id", submissionId);

    if (error) return { ok: false, message: "Could not update the status." };

    await recordEvent({
      submissionId,
      eventType: "result_sent",
      previousStatus: submission.status,
      newStatus: "result_sent",
      metadata: { channel: submission.contact_type },
      actorId: user.id,
    });

    revalidatePath(`/admin/submissions/${submissionId}`);
    revalidatePath("/admin");
    return { ok: true, message: "Marked as sent." };
  });
}

/** Sends the result by email when Resend is configured; otherwise says so. */
export async function sendResultByEmail(submissionId: string): Promise<ActionResult> {
  const { user } = await requireAdmin();
  return reported(async () => {

    const submission = await loadSubmission(submissionId);
    if (!submission) return { ok: false, message: LOAD_FAILED };
    if (submission.contact_type !== "email" || !submission.email) {
      return { ok: false, message: "This customer asked for WhatsApp." };
    }
    if (!submission.result_message) {
      return { ok: false, message: "Generate the result first." };
    }

    const provider = getEmailProvider();
    if (!provider.configured) {
      return {
        ok: false,
        message: "Email isn't configured. Use “Copy email message” and send it yourself.",
      };
    }

    const outcome = await provider.send({
      to: submission.email,
      subject: buildResultSubject(submission.status !== "no_saving", submission.reference_number),
      body: submission.result_message,
      reference: submission.reference_number,
    });

    if (!outcome.sent) return { ok: false, message: outcome.reason };

    const supabase = await createServerSupabaseClient();
    await supabase
      .from("submissions")
      .update({ status: "result_sent", result_sent_at: new Date().toISOString() })
      .eq("id", submissionId);

    await recordEvent({
      submissionId,
      eventType: "result_sent",
      previousStatus: submission.status,
      newStatus: "result_sent",
      metadata: { channel: "email", provider: outcome.providerId },
      actorId: user.id,
    });

    revalidatePath(`/admin/submissions/${submissionId}`);
    revalidatePath("/admin");
    return { ok: true, message: "Email sent." };
  });
}

export async function updateStatus(
  submissionId: string,
  status: SubmissionStatus,
): Promise<ActionResult> {
  const { user } = await requireAdmin();
  return reported(async () => {

    const submission = await loadSubmission(submissionId);
    if (!submission) return { ok: false, message: LOAD_FAILED };

    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.from("submissions").update({ status }).eq("id", submissionId);
    if (error) return { ok: false, message: "Could not update the status." };

    await recordEvent({
      submissionId,
      eventType: "status_changed",
      previousStatus: submission.status,
      newStatus: status,
      actorId: user.id,
    });

    revalidatePath(`/admin/submissions/${submissionId}`);
    revalidatePath("/admin");
    return { ok: true };
  });
}

/**
 * Prove the alert works, without waiting for a customer.
 *
 * Worth a button rather than a paragraph of instructions: the whole product
 * depends on somebody's phone buzzing, so "is it still set up?" is a question
 * worth being able to answer in one tap, on the day it is configured and every
 * time afterwards.
 */
export async function sendTestAlert(): Promise<ActionResult> {
  await requireAdmin();
  return reported(async () => {

    const channels = alertChannels();
    if (channels.length === 0) {
      return {
        ok: false,
        message:
          "No alert channel is configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID, or ADMIN_ALERT_EMAIL.",
      };
    }

    const delivered = await sendTestAdminAlert();
    return delivered
      ? { ok: true, message: `Sent to ${channels.join(" and ")}. Check your phone.` }
      : {
          ok: false,
          message: `${channels.join(" and ")} configured, but the send failed. Check the token and chat id.`,
        };
  });
}

// ---- Areas ----------------------------------------------------------------

export async function createArea(formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const parsed = areaInputSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    active: formData.get("active") === "on" || formData.get("active") === "true",
    sortOrder: Number(formData.get("sortOrder") ?? 100),
    testLocationLabel: String(formData.get("testLocationLabel") ?? ""),
    adminLocationNotes: String(formData.get("adminLocationNotes") ?? ""),
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the area details." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("areas").insert({
    name: parsed.data.name,
    active: parsed.data.active,
    sort_order: parsed.data.sortOrder,
    test_location_label: sanitiseText(parsed.data.testLocationLabel, 120),
    admin_location_notes: sanitiseMultiline(parsed.data.adminLocationNotes, 500),
  });

  if (error) {
    return {
      ok: false,
      message: error.code === "23505" ? "That area already exists." : "Could not add the area.",
    };
  }

  revalidatePath("/admin/areas");
  revalidatePath("/compare");
  return { ok: true, message: "Area added." };
}

export async function updateArea(formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, message: "Missing area." };

  const parsed = areaInputSchema.safeParse({
    name: String(formData.get("name") ?? ""),
    active: formData.get("active") === "on" || formData.get("active") === "true",
    sortOrder: Number(formData.get("sortOrder") ?? 100),
    testLocationLabel: String(formData.get("testLocationLabel") ?? ""),
    adminLocationNotes: String(formData.get("adminLocationNotes") ?? ""),
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the area details." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("areas")
    .update({
      name: parsed.data.name,
      active: parsed.data.active,
      sort_order: parsed.data.sortOrder,
      test_location_label: sanitiseText(parsed.data.testLocationLabel, 120),
      admin_location_notes: sanitiseMultiline(parsed.data.adminLocationNotes, 500),
    })
    .eq("id", id);

  if (error) {
    return {
      ok: false,
      message: error.code === "23505" ? "Another area already has that name." : "Could not save.",
    };
  }

  revalidatePath("/admin/areas");
  revalidatePath("/compare");
  return { ok: true, message: "Area saved." };
}

export async function toggleAreaActive(id: string, active: boolean): Promise<ActionResult> {
  await requireAdmin();

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("areas").update({ active }).eq("id", id);
  if (error) return { ok: false, message: "Could not update the area." };

  revalidatePath("/admin/areas");
  revalidatePath("/compare");
  return { ok: true };
}

// ---- Auth -----------------------------------------------------------------

export async function signIn(formData: FormData): Promise<ActionResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { ok: false, message: "Enter your email and password." };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  // Deliberately vague: it must not reveal whether an account exists.
  if (error) return { ok: false, message: "Those details didn't work. Please try again." };

  const session = await getAdminSession();
  if (!session) {
    await supabase.auth.signOut();
    return { ok: false, message: "This account doesn't have dashboard access." };
  }

  return { ok: true };
}

export async function signOut(): Promise<void> {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
