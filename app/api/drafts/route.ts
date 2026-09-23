import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidVisitId } from "@/lib/analytics/funnel";
import { checkRateLimit, clientKeyFromHeaders } from "@/lib/utils/rate-limit";
import { RATE_LIMIT_WINDOW_MS } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Draft submission management.
 *
 * Handles saving and restoring wizard state across page reloads, especially
 * important for mobile in-app browsers where storage is unreliable.
 *
 * POST: Save/update a draft
 * GET: Retrieve a draft by visit_id
 */

const MAX_DRAFTS_PER_WINDOW = 30; // One per minute for a full wizard flow

export async function GET(request: Request) {
  const url = new URL(request.url);
  const visitId = url.searchParams.get("visitId");

  if (!visitId || !isValidVisitId(visitId)) {
    return NextResponse.json({ error: "Invalid visit ID" }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();

    // Get the most recent non-submitted draft for this visit
    const { data: draft, error } = await supabase
      .from("draft_submissions")
      .select("*")
      .eq("visit_id", visitId)
      .is("submitted_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("[drafts] database error reading draft", { visitId, error });
      return NextResponse.json({ error: "Failed to retrieve draft" }, { status: 500 });
    }

    if (!draft) {
      return NextResponse.json({ draft: null }, { status: 200 });
    }

    // Transform database columns to client format
    return NextResponse.json(
      {
        draft: {
          id: draft.id,
          step: draft.wizard_step,
          state: draft.wizard_state_json,
          cartImagePath: draft.cart_image_path,
          checkoutImagePath: draft.checkout_image_path,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[drafts] unexpected error in GET", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const clientKey = clientKeyFromHeaders(request.headers);

  if (!checkRateLimit(`drafts:${clientKey}`, MAX_DRAFTS_PER_WINDOW, RATE_LIMIT_WINDOW_MS).allowed) {
    return NextResponse.json({ error: "Too many draft saves" }, { status: 429 });
  }

  try {
    const body = (await request.json()) as {
      visitId?: unknown;
      step?: unknown;
      state?: unknown;
      cartImagePath?: unknown;
      checkoutImagePath?: unknown;
    };

    const visitId = typeof body.visitId === "string" ? body.visitId : "";
    if (!isValidVisitId(visitId)) {
      return NextResponse.json({ error: "Invalid visit ID" }, { status: 400 });
    }

    const step = typeof body.step === "number" && [1, 2].includes(body.step) ? body.step : null;
    if (step === null) {
      return NextResponse.json({ error: "Invalid step" }, { status: 400 });
    }

    const state = typeof body.state === "object" && body.state !== null ? body.state : null;
    if (!state) {
      return NextResponse.json({ error: "Missing wizard state" }, { status: 400 });
    }

    const cartImagePath = typeof body.cartImagePath === "string" ? body.cartImagePath : null;
    const checkoutImagePath = typeof body.checkoutImagePath === "string" ? body.checkoutImagePath : null;

    const supabase = createAdminClient();

    // Upsert: update existing draft for this visit, or create new one
    // Only one non-submitted draft per visit at a time
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const { data: draft, error } = await supabase
      .from("draft_submissions")
      .upsert(
        {
          visit_id: visitId,
          wizard_step: step,
          wizard_state_json: state,
          cart_image_path: cartImagePath,
          checkout_image_path: checkoutImagePath,
          expires_at: expiresAt,
        },
        { onConflict: "visit_id" },
      )
      .select()
      .single();

    if (error) {
      console.error("[drafts] database error saving draft", { visitId, error });
      return NextResponse.json({ error: "Failed to save draft" }, { status: 500 });
    }

    // Transform database columns to client format
    return NextResponse.json(
      {
        draft: {
          id: draft.id,
          step: draft.wizard_step,
          state: draft.wizard_state_json,
          cartImagePath: draft.cart_image_path,
          checkoutImagePath: draft.checkout_image_path,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[drafts] unexpected error in POST", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
