import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/supabase/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "Has anyone new shown up since I last asked?" - for the ping in the admin
 * layout, not for a page render.
 *
 * A route rather than a Server Component read: the question is repeated every
 * few seconds from whichever admin page happens to be open, not answered once
 * when a page loads. Same two-gate arrangement as every other admin route -
 * proxy.ts turns away anonymous requests before this runs, requireAdmin()
 * checks again here, and RLS is still the last word on what the query can see.
 *
 * first_seen_at, not last_seen_at: a visit's presence row is upserted on every
 * heartbeat, so last_seen_at changes constantly and would ping for people who
 * have been on the site for an hour. first_seen_at is written once, on that
 * visit's very first heartbeat or funnel event, and never touched again - it
 * is the one honest answer to "is this somebody new".
 */
export async function GET(request: Request) {
  await requireAdmin();

  const url = new URL(request.url);
  const since = url.searchParams.get("since");
  if (!since || Number.isNaN(Date.parse(since))) {
    return NextResponse.json({ error: "A valid 'since' timestamp is required." }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("visit_presence")
    .select("visit_id, first_seen_at")
    .gt("first_seen_at", since)
    .order("first_seen_at", { ascending: true })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as { visit_id: string; first_seen_at: string }[];
  return NextResponse.json({
    count: rows.length,
    // Advances the caller's "since" even on a quiet poll, so the next request
    // still names a real, present timestamp rather than an ever-widening one.
    latestSeenAt: rows.length > 0 ? rows[rows.length - 1].first_seen_at : since,
  });
}
