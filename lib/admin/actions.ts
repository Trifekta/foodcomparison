"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient as createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getAdminSession, requireAdmin } from "@/lib/supabase/auth";
import {
  areaInputSchema,
  comparisonInputSchema,
  submissionEditSchema,
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
import { pushToCustomer } from "@/lib/push/send";
import { getEmailProvider } from "@/lib/notifications/resend";
import { sanitiseMultiline, sanitiseText } from "@/lib/utils/text";
import { normalisePhone } from "@/lib/utils/phone";
import {
  COMPARISON_APP,
  MAX_RESTAURANT_NAME_LENGTH,
  STORAGE_BUCKET,
  UNKNOWN_SOURCE_APP,
} from "@/lib/constants";
import { absoluteUrl, getWebPushConfig } from "@/lib/env";
import { resultPath } from "@/lib/utils/reference";
import {
  formatMinorToDecimalString,
  parseAmountToMinor,
  withAmountStrings,
} from "@/lib/calculations/money";
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
    | "result_sent"
    | "submission_edited"
    | "submission_archived"
    | "submission_unarchived";
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

/**
 * Tell the customer their answer is ready.
 *
 * One sentence for every outcome - a saving, no saving, or a basket nobody
 * could price. The notification is shown on a lock screen and stored by a push
 * service on the way, so it carries no amount, no restaurant and nothing about
 * the person: the number lives behind the token in the link, which is the only
 * place it is safe.
 *
 * Never throws. Every caller has already saved the thing that matters.
 */
async function notifyCustomerResultReady(
  submissionId: string,
  resultToken: string,
): Promise<void> {
  try {
    await pushToCustomer(submissionId, {
      title: "Your SnipSavor result is ready 🎉",
      body: `We checked your basket on ${COMPARISON_APP}. Tap to see the result.`,
      url: resultPath(resultToken),
      // Replaces rather than stacks, so a correction later does not leave two.
      tag: `result-${submissionId}`,
    });
  } catch (error) {
    console.error("[push] could not notify the customer", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
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
  // numeric columns arrive as JSON numbers; the callers below all assume the
  // fixed-2 strings their types promise.
  return data ? withAmountStrings(data) : null;
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

    // Last, and unable to fail the save: the comparison is already written, the
    // result page already shows it, and a push that does not go out costs a
    // notification rather than the work. Awaited only so its own errors are
    // logged rather than lost to an unhandled rejection.
    await notifyCustomerResultReady(parsed.data.submissionId, submission.result_token);

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

    // "We could not compare this one" is an answer too, and the customer has
    // been waiting for it exactly as long.
    await notifyCustomerResultReady(parsed.data.submissionId, submission.result_token);

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

/**
 * Correct what the customer sent.
 *
 * Only the customer's own facts: restaurant, area, the total they are paying,
 * which app it came from, and where to reach them. Nothing the comparison
 * derives is touched here - saveComparison owns the Keeta total, the saving and
 * the message, and duplicating that arithmetic in a second place is how the two
 * drift apart.
 *
 * The edit is recorded with the fields that actually changed, so the audit
 * trail says "the total went from 85.69 to 86.59" rather than "somebody edited
 * this".
 */
export async function editSubmission(formData: FormData): Promise<ActionResult> {
  const { user } = await requireAdmin();
  return reported(async () => {
    const parsed = submissionEditSchema.safeParse({
      submissionId: String(formData.get("submissionId") ?? ""),
      restaurantName: String(formData.get("restaurantName") ?? ""),
      areaId: String(formData.get("areaId") ?? ""),
      currentTotal: String(formData.get("currentTotal") ?? ""),
      sourceApp: String(formData.get("sourceApp") ?? ""),
      contactType: String(formData.get("contactType") ?? ""),
      dialCode: String(formData.get("dialCode") ?? ""),
      whatsappNumber: String(formData.get("whatsappNumber") ?? ""),
      email: String(formData.get("email") ?? ""),
    });

    if (!parsed.success) {
      return { ok: false, message: parsed.error.issues[0]?.message ?? "Please check the fields." };
    }
    const input = parsed.data;

    const before = await loadSubmission(input.submissionId);
    if (!before) return { ok: false, message: LOAD_FAILED };

    const currentTotalMinor = parseAmountToMinor(input.currentTotal);
    if (currentTotalMinor === null) {
      return { ok: false, message: "Enter a valid amount, e.g. 85.69" };
    }

    // One channel is written and the other cleared, so a submission can never
    // carry a stale address the admin thinks they have replaced.
    let whatsappNumber: string | null = null;
    let email: string | null = null;
    if (input.contactType === "whatsapp") {
      try {
        whatsappNumber = normalisePhone(input.dialCode, input.whatsappNumber).e164;
      } catch {
        return { ok: false, message: "Enter a valid mobile number." };
      }
    } else {
      email = input.email.toLowerCase();
    }

    const currentTotal = formatMinorToDecimalString(currentTotalMinor);
    const restaurantName = sanitiseText(input.restaurantName ?? "", MAX_RESTAURANT_NAME_LENGTH);

    const supabase = await createServerSupabaseClient();
    const { error } = await supabase
      .from("submissions")
      .update({
        restaurant_name: restaurantName || null,
        area_id: input.areaId,
        current_total: currentTotal,
        source_app: input.sourceApp || UNKNOWN_SOURCE_APP,
        contact_type: input.contactType,
        whatsapp_number: whatsappNumber,
        email,
      })
      .eq("id", input.submissionId);

    if (error) return { ok: false, message: `Could not save the changes: ${error.message}` };

    // Only what moved. A list of every field would bury the one that matters.
    const changed: Record<string, { from: unknown; to: unknown }> = {};
    if (before.current_total !== currentTotal) {
      changed.current_total = { from: before.current_total, to: currentTotal };
    }
    if ((before.restaurant_name ?? null) !== (restaurantName || null)) {
      changed.restaurant_name = { from: before.restaurant_name, to: restaurantName || null };
    }
    if (before.source_app !== input.sourceApp) {
      changed.source_app = { from: before.source_app, to: input.sourceApp };
    }
    if (before.contact_type !== input.contactType) {
      changed.contact_type = { from: before.contact_type, to: input.contactType };
    }

    await recordEvent({
      submissionId: input.submissionId,
      eventType: "submission_edited",
      previousStatus: before.status,
      newStatus: before.status,
      // Contact details themselves are not recorded - that the channel changed
      // is the useful fact, and the number belongs on the row, not in an
      // audit row that outlives every reason to hold it.
      metadata: { changed: Object.keys(changed), values: changed },
      actorId: user.id,
    });

    revalidatePath(`/admin/submissions/${input.submissionId}`);
    revalidatePath("/admin");
    return { ok: true };
  });
}

/** Out of the working list, without losing what it measured. */
export async function setSubmissionArchived(
  submissionId: string,
  archived: boolean,
): Promise<ActionResult> {
  const { user } = await requireAdmin();
  return reported(async () => {
    const submission = await loadSubmission(submissionId);
    if (!submission) return { ok: false, message: LOAD_FAILED };

    const supabase = await createServerSupabaseClient();
    const { error } = await supabase
      .from("submissions")
      .update({ archived_at: archived ? new Date().toISOString() : null })
      .eq("id", submissionId);

    if (error) {
      return { ok: false, message: `Could not archive this submission: ${error.message}` };
    }

    await recordEvent({
      submissionId,
      eventType: archived ? "submission_archived" : "submission_unarchived",
      previousStatus: submission.status,
      newStatus: submission.status,
      actorId: user.id,
    });

    revalidatePath(`/admin/submissions/${submissionId}`);
    revalidatePath("/admin");
    revalidatePath("/admin/analytics");
    return { ok: true };
  });
}

/**
 * Remove a submission and everything attached to it.
 *
 * Archiving is the answer to "get this out of my way"; this is the answer to
 * "this should not exist" - a customer asking for their data back, or the test
 * rows that were never real. It cannot be undone, which is why the button that
 * calls it asks first.
 *
 * Screenshots go before the row does. The database cascades items, events and
 * extractions, but it knows nothing about the storage bucket, so deleting the
 * row first would leave the customer's cart photo - name, address and order -
 * sitting in storage with nothing left pointing at it. Failing to delete the
 * images therefore stops the whole thing rather than pressing on.
 */
export async function deleteSubmission(submissionId: string): Promise<ActionResult> {
  await requireAdmin();
  return reported(async () => {
    const supabase = await createServerSupabaseClient();

    const { data: row, error: loadError } = await supabase
      .from("submissions")
      .select("id, cart_image_path, checkout_image_path")
      .eq("id", submissionId)
      .maybeSingle<{
        id: string;
        cart_image_path: string | null;
        checkout_image_path: string | null;
      }>();

    if (loadError) return { ok: false, message: `Could not load this submission: ${loadError.message}` };
    if (!row) return { ok: false, message: LOAD_FAILED };

    const paths = [row.cart_image_path, row.checkout_image_path].filter(
      (path): path is string => typeof path === "string" && path.length > 0,
    );

    if (paths.length > 0) {
      const { error: storageError } = await supabase.storage.from(STORAGE_BUCKET).remove(paths);
      if (storageError) {
        return {
          ok: false,
          message: `Could not delete the screenshots, so nothing was removed: ${storageError.message}`,
        };
      }
    }

    const { error } = await supabase.from("submissions").delete().eq("id", submissionId);
    if (error) return { ok: false, message: `Could not delete this submission: ${error.message}` };

    revalidatePath("/admin");
    revalidatePath("/admin/analytics");
    return { ok: true };
  });
}

/**
 * Register this admin browser for new-submission notifications.
 *
 * A server action rather than a route, so the admin check is the same one every
 * other write here uses. The row is written with the service role because the
 * table has no insert policy on purpose: the account a subscription belongs to
 * is decided here, from the session, never from anything the browser sends.
 *
 * Keyed on the endpoint, so one person with a phone and a laptop is two rows
 * and both are notified. Nothing assumes a single admin or a single device.
 */
export async function subscribeAdminPush(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
}): Promise<ActionResult> {
  const { user } = await requireAdmin();
  return reported(async () => {
    if (!getWebPushConfig()) {
      return { ok: false, message: "Push notifications are not configured on the server." };
    }

    if (
      !/^https:\/\/\S+$/.test(input.endpoint) ||
      !/^[A-Za-z0-9_-]{16,200}$/.test(input.p256dh) ||
      !/^[A-Za-z0-9_-]{16,200}$/.test(input.auth)
    ) {
      return { ok: false, message: "That subscription is not usable." };
    }

    const { error } = await createAdminSupabaseClient()
      .from("push_subscriptions")
      .upsert(
        {
          kind: "admin",
          endpoint: input.endpoint,
          p256dh: input.p256dh,
          auth: input.auth,
          admin_id: user.id,
          submission_id: null,
          failure_count: 0,
        },
        { onConflict: "endpoint" },
      );

    if (error) return { ok: false, message: `Could not save the subscription: ${error.message}` };

    revalidatePath("/admin");
    return { ok: true };
  });
}

/** Stop notifying this browser. Scoped to the signed-in admin by RLS. */
export async function unsubscribeAdminPush(endpoint: string): Promise<ActionResult> {
  const { user } = await requireAdmin();
  return reported(async () => {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", endpoint)
      .eq("admin_id", user.id);

    if (error) return { ok: false, message: `Could not turn them off: ${error.message}` };

    revalidatePath("/admin");
    return { ok: true };
  });
}
