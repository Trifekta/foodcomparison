import { NextResponse } from "next/server";
import { getPublicResult } from "@/lib/submissions/result";
import { checkRateLimit, clientKeyFromHeaders } from "@/lib/utils/rate-limit";
import {
  RATE_LIMIT_MAX_RESULT_CHECKS,
  RATE_LIMIT_RESULT_WINDOW_MS,
} from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "Is my result ready yet?"
 *
 * The page holding a result link polls this while the answer is still being
 * worked out. It returns exactly what the page itself was rendered from - the
 * projection in lib/submissions/result.ts - so there is one definition of what
 * a customer may see, not two that can drift apart.
 *
 * A wrong or missing token is a plain 404. It says nothing about whether that
 * token could have existed, which is the only useful thing an attacker could
 * learn from a page keyed on a secret.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  // Namespaced so a customer watching their result cannot exhaust the budget
  // that stops the same browser hammering the submission endpoint.
  const key = `result:${clientKeyFromHeaders(request.headers)}`;
  const limit = checkRateLimit(key, RATE_LIMIT_MAX_RESULT_CHECKS, RATE_LIMIT_RESULT_WINDOW_MS);

  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many checks. Please wait a moment." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const { token } = await params;
  const result = await getPublicResult(token);
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(result, {
    // Never cached anywhere: the whole point is that it changes.
    headers: { "Cache-Control": "no-store" },
  });
}
