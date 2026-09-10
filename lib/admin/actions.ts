"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getAdminSession, requireAdmin } from "@/lib/supabase/auth";
import { areaInputSchema, comparisonInputSchema } from "@/lib/validation/admin";
import { calculateSavingFromStrings, toPersistableSaving } from "@/lib/calculations/saving";
import { buildResultMessage, buildResultSubject } from "@/lib/notifications/messages";
import { getEmailProvider } from "@/lib/notifications/resend";
import { sanitiseMultiline, sanitiseText } from "@/lib/utils/text";
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

function sourceAppLabel(submission: Pick<SubmissionRow, "source_app" | "source_app_other">): string {
  return submission.source_app === "Other" && submission.source_app_other
    ? submission.source_app_other
    : submission.source_app;
}

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
      "id, status, source_app, source_app_other, current_total, comparison_total, comparison_app, contact_type, whatsapp_number, email, reference_number, result_message",
    )
    .eq("id", id)
    .maybeSingle<
      Pick<
        SubmissionRow,
        | "id"
        | "status"
        | "source_app"
        | "source_app_other"
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

  if (error) throw new Error(error.message);
  return data;
}

/** Step 3 of the workflow: new -> reviewing. */
export async function startReview(submissionId: string): Promise<ActionResult> {
  const { user } = await requireAdmin();
  const supabase = await createServerSupabaseClient();

  const submission = await loadSubmission(submissionId);
  if (!submission) return { ok: false, message: "Submission not found." };
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
}

/**
 * Steps 8-11: persist the Keeta total, the derived saving and the internal notes.
 * The maths comes from lib/calculations/saving.ts - it is not recomputed here.
 */
export async function saveComparison(formData: FormData): Promise<ActionResult> {
  const { user } = await requireAdmin();

  const parsed = comparisonInputSchema.safeParse({
    submissionId: String(formData.get("submissionId") ?? ""),
    comparisonTotal: String(formData.get("comparisonTotal") ?? ""),
    restaurantFound: String(formData.get("restaurantFound") ?? ""),
    comparisonLocationNote: String(formData.get("comparisonLocationNote") ?? ""),
    adminNotes: String(formData.get("adminNotes") ?? ""),
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Check the values and retry." };
  }

  const submission = await loadSubmission(parsed.data.submissionId);
  if (!submission) return { ok: false, message: "Submission not found." };

  const comparisonMinor = parseAmountToMinor(parsed.data.comparisonTotal);
  if (comparisonMinor === null) return { ok: false, message: "Enter the Keeta total." };
  const comparisonTotal = formatMinorToDecimalString(comparisonMinor);

  const saving = calculateSavingFromStrings(submission.current_total, comparisonTotal);
  if (!saving) return { ok: false, message: "Could not calculate the saving." };

  const persisted = toPersistableSaving(saving);
  const nextStatus: SubmissionStatus = saving.hasSaving ? "result_ready" : "no_saving";

  const generated = buildResultMessage({
    sourceAppLabel: sourceAppLabel(submission),
    currentTotal: submission.current_total,
    comparisonTotal,
    comparisonAppLabel: submission.comparison_app,
  });

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("submissions")
    .update({
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
}

/**
 * Step 14. Opening WhatsApp is not proof of delivery, so this is always an
 * explicit admin action.
 */
export async function markResultSent(submissionId: string): Promise<ActionResult> {
  const { user } = await requireAdmin();

  const submission = await loadSubmission(submissionId);
  if (!submission) return { ok: false, message: "Submission not found." };
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
}

/** Sends the result by email when Resend is configured; otherwise says so. */
export async function sendResultByEmail(submissionId: string): Promise<ActionResult> {
  const { user } = await requireAdmin();

  const submission = await loadSubmission(submissionId);
  if (!submission) return { ok: false, message: "Submission not found." };
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
}

export async function updateStatus(
  submissionId: string,
  status: SubmissionStatus,
): Promise<ActionResult> {
  const { user } = await requireAdmin();

  const submission = await loadSubmission(submissionId);
  if (!submission) return { ok: false, message: "Submission not found." };

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
