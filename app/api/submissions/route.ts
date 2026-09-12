import { NextResponse } from "next/server";
import { createSubmission } from "@/lib/submissions/create";
import { ERROR_MESSAGES } from "@/lib/validation/submission";
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
  } catch (error) {
    // Worth a log line rather than a silent 400: the body never arrived intact,
    // which is a transport or platform problem and not something the customer
    // can fix by filling the form in differently. The message carries no
    // customer data - it is a parser complaining about bytes.
    console.error("[submissions] could not read the request body", {
      message: error instanceof Error ? error.message : String(error),
      contentLength,
      contentType: request.headers.get("content-type"),
    });

    return NextResponse.json({ error: ERROR_MESSAGES.unreadable }, { status: 400 });
  }

  let result: Awaited<ReturnType<typeof createSubmission>>;
  try {
    result = await createSubmission(formData);
  } catch (error) {
    // createSubmission returns its failures rather than throwing, so reaching
    // here means something unforeseen - a missing secret, a runtime limit, a
    // library throwing where it used to return. Uncaught, it would leave the
    // platform to answer with an HTML error page, which the wizard cannot read
    // as JSON and would report as a dropped connection. Catching it keeps the
    // customer's message honest and puts the cause somewhere we can read it.
    console.error("[submissions] unhandled failure while creating the submission", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json({ error: ERROR_MESSAGES.serverError }, { status: 500 });
  }

  if (!result.ok) {
    // A 500 here is ours, not the customer's; 4xx is a field they can correct
    // and is already spelled out on screen, so it needs no log line.
    if (result.status >= 500) {
      console.error("[submissions] rejected with a server error", {
        status: result.status,
        error: result.error,
      });
    }

    return NextResponse.json({ error: result.error, field: result.field }, { status: result.status });
  }

  // The path, not a full URL: the customer is already on this host, and a token
  // is not something to spell out in a response any more than it has to be.
  return NextResponse.json(
    { referenceNumber: result.referenceNumber, resultPath: resultPath(result.resultToken) },
    { status: 201 },
  );
}
