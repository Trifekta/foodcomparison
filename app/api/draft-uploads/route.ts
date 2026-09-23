import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidVisitId } from "@/lib/analytics/funnel";
import { validateImageFile } from "@/lib/validation/image";
import { STORAGE_BUCKET } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Upload a screenshot to temporary draft storage.
 *
 * Files are stored at drafts/{visitId}/{type}.{ext} and expire after 24 hours
 * via the cleanup cron unless the draft is submitted.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const visitId = url.searchParams.get("visitId");
  const type = url.searchParams.get("type"); // "cart" or "checkout"

  if (!visitId || !isValidVisitId(visitId)) {
    return NextResponse.json({ error: "Invalid visit ID" }, { status: 400 });
  }

  if (type !== "cart" && type !== "checkout") {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const validated = await validateImageFile(file, `${type} screenshot`);
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const supabase = createAdminClient();
    const path = `drafts/${visitId}/${type}.${validated.extension}`;

    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, validated.bytes, {
        contentType: validated.mimeType,
        upsert: true,
      });

    if (error) {
      console.error("[draft-uploads] could not store file", {
        bucket: STORAGE_BUCKET,
        path,
        message: error.message,
      });
      return NextResponse.json(
        { error: "Failed to upload file" },
        { status: 500 }
      );
    }

    return NextResponse.json({ path }, { status: 200 });
  } catch (error) {
    console.error("[draft-uploads] unexpected error", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
