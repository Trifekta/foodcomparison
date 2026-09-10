import { NextResponse } from "next/server";
import { createSubmission } from "@/lib/submissions/create";
import { checkRateLimit, clientKeyFromHeaders } from "@/lib/utils/rate-limit";
import { MAX_IMAGE_BYTES } from "@/lib/constants";
import { resultPath } from "@/lib/utils/reference";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public submission endpoint.
 *
 * The only write path available to an anonymous customer. There is no matching
 * GET: submissions cannot be listed or read from outside the admin dashboard.
 */
export async function POST(request: Request) {
  const key = clientKeyFromHeaders(request.headers);
  const limit = checkRateLimit(key);

  if (!limit.allowed) {
    return NextResponse.json(
      { error: "That's a lot of orders in a short time. Please try again in a few minutes." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  // Two 10 MB images plus fields; anything larger is rejected before parsing.
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_IMAGE_BYTES * 2 + 1024 * 64) {
    return NextResponse.json({ error: "This image is larger than 10 MB." }, { status: 413 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      {
        error:
          "We couldn't submit your order. Your information hasn't been lost. Please try again.",
      },
      { status: 400 },
    );
  }

  const result = await createSubmission(formData);

  if (!result.ok) {
    return NextResponse.json({ error: result.error, field: result.field }, { status: result.status });
  }

  // The path, not a full URL: the customer is already on this host, and a token
  // is not something to spell out in a response any more than it has to be.
  return NextResponse.json(
    { referenceNumber: result.referenceNumber, resultPath: resultPath(result.resultToken) },
    { status: 201 },
  );
}
