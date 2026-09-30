import { createSubmission } from "@/lib/submissions/create";
import { ERROR_MESSAGES } from "@/lib/validation/submission";
import { checkRateLimit, clientKeyFromHeaders } from "@/lib/utils/rate-limit";
import { MAX_IMAGE_BYTES } from "@/lib/constants";
import { resultPath } from "@/lib/utils/reference";
import { absoluteLink, checkClient } from "@/lib/api/v1/guard";
import { apiData, apiError, rateLimited } from "@/lib/api/v1/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/v1/submissions - the mobile apps' way in.
 *
 * The same form fields as /api/submissions, and the same createSubmission()
 * behind it: validation, upload, insert, admin alerts. What differs is only the
 * edges - the caller must name itself (X-SnipSavor-Client), the reply carries
 * the result token and an absolute link rather than a path on a site the app
 * is not on, and failures come back with a code.
 *
 * Wizard drafts are deliberately not handled. They exist because mobile
 * browsers discard backgrounded tabs; an app keeps its own state.
 */
export async function POST(request: Request) {
  const check = checkClient(request);
  if (!check.ok) return check.response;

  // The same bucket as /api/submissions, unprefixed, so a second door never
  // means a second allowance.
  const limit = checkRateLimit(clientKeyFromHeaders(request.headers));
  if (!limit.allowed) {
    return rateLimited(
      "That's a lot of orders in a short time. Please try again in a few minutes.",
      limit.retryAfterSeconds,
    );
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_IMAGE_BYTES * 2 + 1024 * 64) {
    return apiError("payload_too_large", "This image is larger than 10 MB.", 413);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (error) {
    console.error("[v1/submissions] could not read the request body", {
      message: error instanceof Error ? error.message : String(error),
      contentLength,
      contentType: request.headers.get("content-type"),
      platform: check.client.platform,
    });
    return apiError("unreadable_body", ERROR_MESSAGES.unreadable, 400);
  }

  let result: Awaited<ReturnType<typeof createSubmission>>;
  try {
    result = await createSubmission(formData, { client: check.client });
  } catch (error) {
    console.error("[v1/submissions] unhandled failure while creating the submission", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return apiError("server_error", ERROR_MESSAGES.serverError, 500);
  }

  if (!result.ok) {
    if (result.status >= 500) {
      console.error("[v1/submissions] rejected with a server error", {
        status: result.status,
        code: result.code,
      });
    }
    return apiError(result.code, result.error, result.status, { field: result.field });
  }

  const path = resultPath(result.resultToken);
  return apiData(
    {
      referenceNumber: result.referenceNumber,
      // The app keeps this to reopen the result and to poll it. It is the whole
      // of the authorisation for this one result, exactly as the web link is.
      resultToken: result.resultToken,
      resultPath: path,
      resultUrl: absoluteLink(path, request),
    },
    { status: 201 },
  );
}
