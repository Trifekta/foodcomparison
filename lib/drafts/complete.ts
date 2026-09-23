import "server-only";

import type { NextResponse } from "next/server";
import { getDraftResumeMode } from "@/lib/env";
import { isWellFormedDraftToken } from "./token";
import { clearDraftCookie, presentedToken } from "./http";
import { deleteDraft, findDraft } from "./store";

/**
 * Throws away the draft a submission was made from.
 *
 * Called only once a submission has been written, so nothing here can cost
 * the customer their order: it never throws, and with DRAFT_RESUME off it does
 * nothing at all. A draft that survives a failure here expires within a day
 * and is pruned with its files.
 */
export async function completeDraftAfterSubmission(
  request: Request,
  formData: FormData,
  response: NextResponse,
): Promise<void> {
  if (getDraftResumeMode() === "off") return;

  try {
    const fromForm = formData.get("draftToken");
    const token = isWellFormedDraftToken(fromForm) ? fromForm : presentedToken(request)?.token;
    if (!token) return;

    clearDraftCookie(response, request);
    const draft = await findDraft(token);
    if (draft) await deleteDraft(draft);
  } catch (error) {
    console.error("[drafts] could not clear a submitted draft", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
