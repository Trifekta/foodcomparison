import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getWebPushConfig } from "@/lib/env";
import { encryptPayload, vapidAuthorization } from "./crypto";

/**
 * Sending a push, and forgetting a browser that has gone.
 *
 * Every function here swallows its failures. A push is the last thing that
 * happens after a result is saved or a submission is written, and neither of
 * those may fail because a notification could not be delivered - the customer's
 * order still exists, the admin's comparison is still recorded, and the result
 * page still shows the answer to anybody who opens it. A failed push is a log
 * line, never an error in front of anybody.
 */

/**
 * What makes a subscription row the "same" one.
 *
 * Endpoint AND role. On endpoint alone, a customer subscription overwrote the
 * admin registration on the same browser - which is the normal case, since the
 * admin tests the customer flow on their own phone - and the only symptom was a
 * notification that never arrived. Named here so the two places that upsert
 * cannot drift apart again. See migration 0016.
 */
export const PUSH_CONFLICT_TARGET = "endpoint,kind";

export interface PushPayload {
  title: string;
  body: string;
  /** Where tapping it should land. A path on this site, never a full URL. */
  url: string;
  /** Groups notifications so a second one replaces the first, not stacks. */
  tag?: string;
}

/**
 * What a send did, for the one caller that needs to say so out loud.
 *
 * Everything here still swallows its failures - nothing upstream may break
 * because a notification did not arrive. But "nothing happened" and "the push
 * service rejected it" are different problems with different fixes, and a test
 * button that cannot tell them apart is not a test button. So the reasons are
 * collected as well as logged, and the admin's own test is allowed to read them.
 */
export interface SendReport {
  /** Browsers on the list. Zero means nobody has turned notifications on. */
  attempted: number;
  /** Browsers the push service accepted it for. */
  delivered: number;
  /** One line per failure, in the push service's terms. */
  failures: string[];
}

const NOTHING: SendReport = { attempted: 0, delivered: 0, failures: [] };

interface SubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** How long a push service is given before we stop waiting on it. */
const SEND_TIMEOUT_MS = 8_000;

/**
 * Ten minutes. Long enough to survive a phone that is asleep, short enough that
 * a result nobody opened does not arrive the next morning as news.
 */
const TTL_SECONDS = 600;

/**
 * What the browser is told.
 *
 * Deliberately thin. A notification is rendered by the operating system, is
 * visible on a lock screen, and is stored by the push service on its way - so
 * nothing here names the customer, their number, their address or their
 * restaurant. The title, a sentence, and a link that is useless without the
 * token already in it.
 */
function sanitise(payload: PushPayload): string {
  const clean = (value: string, max: number) =>
    value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);

  return JSON.stringify({
    title: clean(payload.title, 80),
    body: clean(payload.body, 160),
    // A path, and only a path. Anything else would let a payload point a tap at
    // another site.
    url: payload.url.startsWith("/") ? clean(payload.url, 300) : "/",
    tag: payload.tag ? clean(payload.tag, 60) : undefined,
  });
}

async function deleteSubscription(id: string): Promise<void> {
  try {
    await createAdminClient().from("push_subscriptions").delete().eq("id", id);
  } catch {
    // A row we could not delete is a row that fails again next time and is
    // deleted then. Not worth surfacing.
  }
}

/**
 * One push to one browser.
 *
 * Returns why it did not arrive when it did not, but nothing upstream depends
 * on the answer - it exists so a count and a reason can be reported.
 */
async function sendOne(
  subscription: SubscriptionRow,
  payload: PushPayload,
): Promise<{ ok: boolean; reason?: string }> {
  const config = getWebPushConfig();
  if (!config) return { ok: false, reason: "No VAPID keys are set on the server." };

  try {
    const { body } = await encryptPayload(sanitise(payload), subscription.p256dh, subscription.auth);
    const authorization = await vapidAuthorization(
      subscription.endpoint,
      config.publicKey,
      config.privateKey,
      config.subject,
    );

    const response = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        TTL: String(TTL_SECONDS),
        Urgency: "high",
      },
      body: body as BodyInit,
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });

    if (response.ok) return { ok: true };

    // 404 and 410 are the push service saying this endpoint no longer exists -
    // the browser was uninstalled, the permission revoked, the subscription
    // replaced. Anything else is transient and the row is left alone.
    if (response.status === 404 || response.status === 410) {
      await deleteSubscription(subscription.id);
      console.warn("[push] endpoint gone, subscription removed", {
        status: response.status,
      });
      return {
        ok: false,
        reason: `${response.status} - that browser's subscription no longer exists, so it has been removed. Turn notifications on again on that device.`,
      };
    }

    console.error("[push] push service refused the message", {
      status: response.status,
      statusText: response.statusText,
    });
    // 401 and 403 here mean the VAPID signature was not accepted, which in
    // practice means the private key on the server is not the pair of the
    // public key the browser subscribed with. Worth saying, because the fix is
    // not obvious: every device has to subscribe again after a key change.
    const hint =
      response.status === 401 || response.status === 403
        ? " - the push service rejected our key. If the VAPID keys were changed, every device must turn notifications on again."
        : "";
    return {
      ok: false,
      reason: `${response.status} ${response.statusText}${hint}`.trim(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[push] could not send", { message });
    return { ok: false, reason: message };
  }
}

async function sendToAll(rows: SubscriptionRow[], payload: PushPayload): Promise<SendReport> {
  if (rows.length === 0) return NOTHING;

  const results = await Promise.all(rows.map((row) => sendOne(row, payload)));

  return {
    attempted: rows.length,
    delivered: results.filter((result) => result.ok).length,
    // Deduplicated: ten devices behind one broken key is one thing to fix, not
    // ten lines of the same sentence.
    failures: [...new Set(results.flatMap((result) => (result.reason ? [result.reason] : [])))],
  };
}

/** Every browser that asked to hear about this one submission. */
export async function pushToCustomer(
  submissionId: string,
  payload: PushPayload,
): Promise<SendReport> {
  if (!getWebPushConfig()) return NOTHING;

  try {
    const { data } = await createAdminClient()
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("kind", "customer")
      .eq("submission_id", submissionId);

    return await sendToAll((data ?? []) as SubscriptionRow[], payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[push] customer notification failed", { message });
    return { attempted: 0, delivered: 0, failures: [message] };
  }
}

/**
 * Every admin device listening.
 *
 * Plural on purpose: one person with a phone and a laptop is two rows, and a
 * second admin later is more. Nothing here assumes there is one.
 */
export async function pushToAdmins(payload: PushPayload): Promise<SendReport> {
  if (!getWebPushConfig()) {
    return { attempted: 0, delivered: 0, failures: ["No VAPID keys are set on the server."] };
  }

  try {
    const { data } = await createAdminClient()
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("kind", "admin");

    return await sendToAll((data ?? []) as SubscriptionRow[], payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[push] admin notification failed", { message });
    return { attempted: 0, delivered: 0, failures: [message] };
  }
}
