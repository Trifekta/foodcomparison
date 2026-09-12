import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidResultToken } from "@/lib/utils/reference";
import { checkRateLimit, clientKeyFromHeaders } from "@/lib/utils/rate-limit";
import { RATE_LIMIT_WINDOW_MS } from "@/lib/constants";
import { getWebPushConfig } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Where a customer's browser registers for their own result.
 *
 * Public, because the customer is not signed in to anything - so the result
 * token is what authorises it. Holding the token already means being able to
 * read the result; being able to subscribe to it grants nothing further, and
 * without a valid token nothing is written at all.
 *
 * The token is exchanged for the submission id here rather than being stored,
 * so the subscription row never carries the address of the customer's page.
 *
 * Writes go through the service role after that check, exactly as /api/events
 * does: the table has no anon policy, which is what keeps it unreachable from
 * outside this route.
 */

const MAX_SUBSCRIBES_PER_WINDOW = 10;

/** Base64url, the shape both browser keys arrive in. */
const KEY_PATTERN = /^[A-Za-z0-9_-]{16,200}$/;

/**
 * Only the three push services browsers actually use.
 *
 * Without this the endpoint is an open relay: anybody could register a URL of
 * their choosing and have this server POST to it on a schedule of their
 * choosing. The allowlist is what makes that a closed set.
 */
const ALLOWED_HOSTS = [
  "android.googleapis.com",
  "fcm.googleapis.com",
  "updates.push.services.mozilla.com",
  "web.push.apple.com",
];

function isAllowedEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:") return false;
    return ALLOWED_HOSTS.some(
      (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
    );
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  if (!getWebPushConfig()) {
    return NextResponse.json({ error: "Notifications are not configured." }, { status: 503 });
  }

  const key = `push-sub:${clientKeyFromHeaders(request.headers)}`;
  if (!checkRateLimit(key, MAX_SUBSCRIBES_PER_WINDOW, RATE_LIMIT_WINDOW_MS).allowed) {
    return NextResponse.json({ error: "Too many attempts." }, { status: 429 });
  }

  try {
    const body = (await request.json()) as {
      token?: unknown;
      endpoint?: unknown;
      p256dh?: unknown;
      auth?: unknown;
    };

    const token = typeof body.token === "string" ? body.token : "";
    const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
    const p256dh = typeof body.p256dh === "string" ? body.p256dh : "";
    const auth = typeof body.auth === "string" ? body.auth : "";

    if (!isValidResultToken(token)) {
      return NextResponse.json({ error: "Unknown result." }, { status: 400 });
    }
    if (!isAllowedEndpoint(endpoint) || !KEY_PATTERN.test(p256dh) || !KEY_PATTERN.test(auth)) {
      return NextResponse.json({ error: "That subscription is not usable." }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: submission } = await supabase
      .from("submissions")
      .select("id")
      .eq("result_token", token)
      .maybeSingle<{ id: string }>();

    // A token nobody recognises is answered exactly like a malformed one, so
    // this cannot be used to find out which tokens exist.
    if (!submission) {
      return NextResponse.json({ error: "Unknown result." }, { status: 400 });
    }

    // A browser that resubscribes returns the same endpoint. Upserting on it
    // keeps one row per browser and lets a device that was reinstalled take
    // over its old endpoint rather than leaving a dead row behind.
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        kind: "customer",
        endpoint,
        p256dh,
        auth,
        submission_id: submission.id,
        admin_id: null,
        failure_count: 0,
      },
      { onConflict: "endpoint" },
    );

    if (error) {
      console.error("[push] could not store the customer subscription", {
        message: error.message,
      });
      return NextResponse.json({ error: "Could not turn notifications on." }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Could not turn notifications on." }, { status: 400 });
  }
}
