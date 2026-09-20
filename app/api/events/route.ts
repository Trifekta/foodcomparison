import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isTrackedEvent, isValidVisitId } from "@/lib/analytics/funnel";
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

/**
 * Heartbeats get their own, far larger budget rather than sharing the one
 * above. They fire every 20 seconds per open tab - one visit alone can use a
 * third of MAX_EVENTS_PER_WINDOW just staying on a page - and this endpoint is
 * keyed by IP, so a handful of people on the same office or venue wifi (the
 * exact traffic an ad is meant to bring) would otherwise trip the shared limit
 * and start silently losing real funnel steps along with their heartbeats.
 * 300 per ten minutes is thirty visits' worth of heartbeats behind one IP,
 * which is a lot of people testing this from one room, not a script.
 */
const MAX_HEARTBEATS_PER_WINDOW = 300;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const clientKey = clientKeyFromHeaders(request.headers);

  try {
    const body = (await request.json()) as {
      event?: unknown;
      visitId?: unknown;
      token?: unknown;
      areaId?: unknown;
    };

    const event = typeof body.event === "string" ? body.event : "";
    const visitId = typeof body.visitId === "string" ? body.visitId : "";
    if (!isValidVisitId(visitId)) {
      return new NextResponse(null, { status: 204 });
    }

    // A pulse, not a step: sent every 20 seconds while a tab stays open (see
    // lib/analytics/track.ts) so the live admin view can tell "still here"
    // from "left a while ago", which nothing that fires only on a step change
    // can say. It touches last_seen_at alone - the visit's current step, area
    // and submission stay whatever the last real event said they were.
    if (event === "heartbeat") {
      if (
        !checkRateLimit(`heartbeat:${clientKey}`, MAX_HEARTBEATS_PER_WINDOW, RATE_LIMIT_WINDOW_MS)
          .allowed
      ) {
        return new NextResponse(null, { status: 204 });
      }

      await createAdminClient()
        .from("visit_presence")
        .upsert({ visit_id: visitId, last_seen_at: new Date().toISOString() }, { onConflict: "visit_id" });
      return new NextResponse(null, { status: 204 });
    }

    if (!checkRateLimit(`events:${clientKey}`, MAX_EVENTS_PER_WINDOW, RATE_LIMIT_WINDOW_MS).allowed) {
      return new NextResponse(null, { status: 204 });
    }

    // Funnel steps and the side events beside them (see SIDE_EVENTS) are stored
    // the same way and told apart by the readers: computeFunnel and
    // summarizeVisits both walk FUNNEL_STEPS, so a side event lands in the table
    // and is stepped over by every calculation that ranks progress.
    if (!isTrackedEvent(event)) {
      return new NextResponse(null, { status: 204 });
    }

    const supabase = createAdminClient();

    // The result page knows its token, not its submission id. Resolving it here
    // means the browser never has to be told an internal id.
    let submissionId: string | null = null;
    const token = typeof body.token === "string" ? body.token : "";

    if (isValidResultToken(token)) {
      const { data } = await supabase
        .from("submissions")
        .select("id")
        .eq("result_token", token)
        .maybeSingle();
      submissionId = (data as { id: string } | null)?.id ?? null;
    }

    // Shape-checked, not trusted: a value that is not a uuid is dropped rather
    // than sent to Postgres, which would answer with an error this endpoint has
    // promised never to show anybody. A uuid that is not a real area fails the
    // foreign key, and the catch below swallows that too - a bad area costs the
    // event, never the customer's screen.
    const areaId =
      typeof body.areaId === "string" && UUID_PATTERN.test(body.areaId) ? body.areaId : null;

    await Promise.all([
      supabase
        .from("funnel_events")
        .insert({ event, visit_id: visitId, submission_id: submissionId, area_id: areaId }),
      // A real step updates presence too, so a visit's current step is never
      // more stale than its last heartbeat even if that beat is seconds away.
      supabase.from("visit_presence").upsert(
        {
          visit_id: visitId,
          last_seen_at: new Date().toISOString(),
          last_event: event,
          submission_id: submissionId,
          area_id: areaId,
        },
        { onConflict: "visit_id" },
      ),
    ]);
  } catch {
    // Counting is never worth an error in front of a customer.
  }

  return new NextResponse(null, { status: 204 });
}
