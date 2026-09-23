import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Clean up expired draft submissions.
 *
 * Deletes:
 * 1. Draft records older than 24 hours
 * 2. Corresponding files in storage (drafts/ prefix)
 *
 * Called by an external scheduler (e.g., GitHub Actions, Vercel Cron)
 * with a secret token for authentication.
 */

const CRON_SECRET = process.env.CRON_SECRET;

export async function POST(request: Request) {
  // Verify cron secret from Authorization header
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !CRON_SECRET) {
    console.warn("[cleanup-drafts] cron request without secret or secret not configured");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!authHeader.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = authHeader.slice(7);
  if (token !== CRON_SECRET) {
    console.warn("[cleanup-drafts] invalid cron token");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();
    const now = new Date().toISOString();

    // Get expired drafts before deleting so we know which files to clean up
    const { data: expiredDrafts, error: selectError } = await supabase
      .from("draft_submissions")
      .select("id, cart_image_path, checkout_image_path")
      .lt("expires_at", now)
      .is("submitted_at", null);

    if (selectError) {
      console.error("[cleanup-drafts] error reading expired drafts", selectError);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    if (!expiredDrafts || expiredDrafts.length === 0) {
      return NextResponse.json({ cleaned: 0, deleted: 0 }, { status: 200 });
    }

    // Delete storage files
    const filesToDelete: string[] = [];
    for (const draft of expiredDrafts) {
      if (draft.cart_image_path) filesToDelete.push(draft.cart_image_path);
      if (draft.checkout_image_path) filesToDelete.push(draft.checkout_image_path);
    }

    let deletedFiles = 0;
    if (filesToDelete.length > 0) {
      const { error: deleteError } = await supabase.storage
        .from("submission-images")
        .remove(filesToDelete);

      if (deleteError) {
        console.error("[cleanup-drafts] error deleting storage files", deleteError);
        // Continue anyway - don't fail the whole cleanup if storage cleanup fails
      } else {
        deletedFiles = filesToDelete.length;
      }
    }

    // Delete draft database records
    const { error: deleteRecordsError } = await supabase
      .from("draft_submissions")
      .delete()
      .lt("expires_at", now)
      .is("submitted_at", null);

    if (deleteRecordsError) {
      console.error("[cleanup-drafts] error deleting draft records", deleteRecordsError);
      return NextResponse.json({ error: "Failed to clean up records" }, { status: 500 });
    }

    const deletedRecords = expiredDrafts.length;

    console.log("[cleanup-drafts] cleanup complete", {
      deletedRecords,
      deletedFiles,
    });

    return NextResponse.json(
      { cleaned: deletedRecords, deleted: deletedFiles },
      { status: 200 },
    );
  } catch (error) {
    console.error("[cleanup-drafts] unexpected error", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
