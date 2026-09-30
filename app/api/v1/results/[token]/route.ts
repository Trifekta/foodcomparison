import { getPublicResult } from "@/lib/submissions/result";
import { checkRateLimit, clientKeyFromHeaders } from "@/lib/utils/rate-limit";
import { RATE_LIMIT_MAX_RESULT_CHECKS, RATE_LIMIT_RESULT_WINDOW_MS } from "@/lib/constants";
import { resultPath } from "@/lib/utils/reference";
import { absoluteLink, checkClient } from "@/lib/api/v1/guard";
import { apiData, apiError, rateLimited } from "@/lib/api/v1/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/v1/results/:token - "is my result ready yet?", for the apps.
 *
 * The same projection the web result page and /api/result/:token read
 * (getPublicResult), so there is still one definition of what a customer may
 * see. Added on top: absolute links, because an app has no page to resolve a
 * relative path against.
 *
 * A wrong, malformed or deleted token is the same 404, as on the web.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const check = checkClient(request);
  if (!check.ok) return check.response;

  // Shares the web's polling budget: one customer, one allowance.
  const key = `result:${clientKeyFromHeaders(request.headers)}`;
  const limit = checkRateLimit(key, RATE_LIMIT_MAX_RESULT_CHECKS, RATE_LIMIT_RESULT_WINDOW_MS);
  if (!limit.allowed) {
    return rateLimited("Too many checks. Please wait a moment.", limit.retryAfterSeconds);
  }

  const { token } = await params;
  const result = await getPublicResult(token);
  if (!result) {
    return apiError("result_not_found", "We couldn't find that result.", 404);
  }

  return apiData({
    ...result,
    resultUrl: absoluteLink(resultPath(token), request),
    // The /go/ redirect records the switch and forwards to Keeta. An app that
    // appends its visit id as ?v= gets its switches counted per visitor, as
    // the website's button does.
    switchUrl: result.switchPath ? absoluteLink(result.switchPath, request) : null,
  });
}
