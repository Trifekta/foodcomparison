import { NextResponse } from "next/server";
import { chaseUnansweredSubmissions } from "@/lib/notifications/chase";
import { getCronSecret } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "Is anything still waiting?", asked on a schedule.
 *
 * A route rather than a Worker cron handler, because this app is built by
 * OpenNext and its entry point belongs to the adapter - wrapping it to add a
 * scheduled() export would mean owning a build step for one function. A URL any
 * scheduler can call is the same job without that cost, and it is the pattern
 * the README already describes for pruning screenshots.
 *
 * Protected by a shared secret in a header rather than by a session, because
 * the caller is a machine with no account. Without CRON_SECRET set the route
 * refuses everything: a chaser anybody can trigger is a way to make somebody's
 * phone buzz on demand.
 */

function isAuthorised(request: Request, secret: string): boolean {
  // Two spellings so this works with whichever scheduler is used: a plain
  // header where one can be set, and a bearer token where only Authorization
  // is available.
  const header = request.headers.get("x-cron-secret");
  const bearer = request.headers.get("authorization");
  return header === secret || bearer === `Bearer ${secret}`;
}

async function run(request: Request) {
  const secret = getCronSecret();
  if (!secret) {
    return NextResponse.json({ error: "Not configured." }, { status: 503 });
  }

  if (!isAuthorised(request, secret)) {
    // 404 rather than 401: an unauthenticated caller learns nothing about
    // whether this route exists.
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  try {
    const outcome = await chaseUnansweredSubmissions();

    // Logged even when nothing was waiting, so a scheduler that has quietly
    // stopped calling is visible as an absence of these lines rather than as
    // an absence of reminders nobody was expecting anyway.
    console.info("[chase] run complete", outcome);

    return NextResponse.json(outcome, { status: 200 });
  } catch (error) {
    console.error("[chase] run failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "The check failed." }, { status: 500 });
  }
}

// GET as well as POST: some schedulers only offer one, and this is idempotent
// in the way that matters - a row already chased is never chased twice.
export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
