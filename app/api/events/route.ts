import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isFunnelEvent, isValidVisitId } from "@/lib/analytics/funnel";
import { isValidResultToken } from "@/lib/utils/reference";
import { checkRateLimit, clientKeyFromHeaders } from "@/lib/utils/rate-limit";
import { RATE_LIMIT_WINDOW_MS } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Where the funnel steps are recorded.
 *
 * Public, because the people being counted are not signed in to anything - but
 * the only thing it will accept is one of the known step names and a visit id
 * of the right shape. There is no free-text field, nothing is read back, and
 * the write goes through the service role rather than an anon policy, so the
 * table stays unreachable from outside exactly like every other one.
 *
 * Always answers 204, whatever happened. A counter that made a customer's
 * browser log an error, or that let someone learn anything by probing it, would
 * be worse than no counter.
 */
const MAX_EVENTS_PER_WINDOW = 60;

export async function POST(request: Request) {
  const key = `events:${clientKeyFromHeaders(request.headers)}`;
  if (!checkRateLimit(key, MAX_EVENTS_PER_WINDOW, RATE_LIMIT_WINDOW_MS).allowed) {
    return new NextResponse(null, { status: 204 });
  }

  try {
    const body = (await request.json()) as {
      event?: unknown;
      visitId?: unknown;
      token?: unknown;
    };

    const event = typeof body.event === "string" ? body.event : "";
    const visitId = typeof body.visitId === "string" ? body.visitId : "";
    if (!isFunnelEvent(event) || !isValidVisitId(visitId)) {
      return new NextResponse(null, { status: 204 });
    }

    // The result page knows its token, not its submission id. Resolving it here
    // means the browser never has to be told an internal id.
    let submissionId: string | null = null;
    const token = typeof body.token === "string" ? body.token : "";
    const supabase = createAdminClient();

    if (isValidResultToken(token)) {
      const { data } = await supabase
        .from("submissions")
        .select("id")
        .eq("result_token", token)
        .maybeSingle();
      submissionId = (data as { id: string } | null)?.id ?? null;
    }

    await supabase
      .from("funnel_events")
      .insert({ event, visit_id: visitId, submission_id: submissionId });
  } catch {
    // Counting is never worth an error in front of a customer.
  }

  return new NextResponse(null, { status: 204 });
}
