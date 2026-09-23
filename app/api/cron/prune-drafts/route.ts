import { NextResponse } from "next/server";
import { getCronSecret } from "@/lib/env";
import { pruneDrafts } from "@/lib/drafts/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Deletes expired wizard drafts, their screenshots, and any drafts/ folder
 * whose row is already gone. Same secret and same refusals as the chase route.
 *
 * Runs whatever DRAFT_RESUME says: turning the feature off must not strand the
 * files it already wrote.
 */

function isAuthorised(request: Request, secret: string): boolean {
  const header = request.headers.get("x-cron-secret");
  const bearer = request.headers.get("authorization");
  return header === secret || bearer === `Bearer ${secret}`;
}

async function run(request: Request) {
  const secret = getCronSecret();
  if (!secret) return NextResponse.json({ error: "Not configured." }, { status: 503 });
  if (!isAuthorised(request, secret)) return NextResponse.json({ error: "Not found." }, { status: 404 });

  try {
    const outcome = await pruneDrafts();
    console.info("[prune-drafts] run complete", outcome);
    return NextResponse.json(outcome, { status: 200 });
  } catch (error) {
    console.error("[prune-drafts] run failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "The prune failed." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
