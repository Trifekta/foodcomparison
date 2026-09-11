import { NextResponse } from "next/server";
import { findResultPath } from "@/lib/submissions/result";
import { checkRateLimit, clientKeyFromHeaders } from "@/lib/utils/rate-limit";
import { RATE_LIMIT_WINDOW_MS } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "I've got a reference, where's my order?"
 *
 * Guarded harder than anything else here, because it is the one endpoint that
 * takes a short human-sized code. Both halves must match - the reference and
 * the contact the result was going to - and a wrong guess is the same answer as
 * a reference that never existed, so nothing can be learned by trying.
 *
 * Ten attempts per ten minutes. With six characters over a thirty-symbol
 * alphabet and the contact detail needed as well, that is not a door anyone
 * gets through by pushing.
 */
const MAX_ATTEMPTS = 10;

export async function POST(request: Request) {
  const key = `lookup:${clientKeyFromHeaders(request.headers)}`;
  const limit = checkRateLimit(key, MAX_ATTEMPTS, RATE_LIMIT_WINDOW_MS);

  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many tries. Please wait a few minutes." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  let body: { reference?: unknown; contact?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Check the details and try again." }, { status: 400 });
  }

  const reference = typeof body.reference === "string" ? body.reference : "";
  const contact = typeof body.contact === "string" ? body.contact : "";

  const path = await findResultPath(reference, contact);
  if (!path) {
    // Deliberately one message for every kind of miss.
    return NextResponse.json(
      { error: "We couldn't find an order with those details. Check both and try again." },
      { status: 404 },
    );
  }

  return NextResponse.json({ resultPath: path }, { headers: { "Cache-Control": "no-store" } });
}
