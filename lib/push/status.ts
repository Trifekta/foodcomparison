import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCronSecret, getWebPushConfig, publicEnv } from "@/lib/env";
import { UNANSWERED_AFTER_MINUTES } from "@/lib/constants";

/**
 * Why no notification arrived.
 *
 * Push has four separate things that must all be true, and when one of them is
 * not, the symptom is identical in every case: silence. Nothing errors, nothing
 * is logged where anybody will look, and the admin is left guessing between a
 * missing key, a device that was never registered, a browser that refused, and
 * a push service that rejected the send.
 *
 * This asks each question separately so the answer is a sentence rather than a
 * guess. It is read by the diagnostics page and by nothing else.
 */

export interface PushStatus {
  /** Both VAPID keys present. Without this the toggle does not even render. */
  configured: boolean;
  /** The contact address sent to push services. */
  subject: string | null;
  /** Admin browsers currently on the list. Zero is the usual reason for silence. */
  adminDevices: number;
  /** Customer browsers waiting on a result. */
  customerDevices: number;
  /** Whether the table exists and could be read at all. */
  tableReadable: boolean;
  /** The database's own words when it could not be. */
  tableError: string | null;
  /** Whether the chaser route will answer a scheduler. */
  chaserConfigured: boolean;
  /** How long a submission may sit before the chaser nudges. */
  chaserAfterMinutes: number;
  /**
   * The origin links in Telegram and email are built from.
   *
   * Here because a push subscription belongs to one origin: moving the site to
   * a new hostname leaves every existing subscription behind on the old one,
   * and this is the value that shows the move happened.
   */
  appUrl: string | null;
}

export async function getPushStatus(): Promise<PushStatus> {
  const config = getWebPushConfig();

  const base = {
    configured: config !== null,
    subject: config?.subject ?? null,
    chaserConfigured: getCronSecret() !== null,
    chaserAfterMinutes: UNANSWERED_AFTER_MINUTES,
    appUrl: publicEnv.appUrl.trim() || null,
  };

  // The service role, because the point is to count what is there rather than
  // what this admin is allowed to see - a count filtered by a policy would
  // report zero for exactly the problem being diagnosed.
  try {
    const supabase = createAdminClient();

    const [admin, customer] = await Promise.all([
      supabase
        .from("push_subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("kind", "admin"),
      supabase
        .from("push_subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("kind", "customer"),
    ]);

    if (admin.error) {
      return {
        ...base,
        adminDevices: 0,
        customerDevices: 0,
        tableReadable: false,
        tableError: admin.error.message,
      };
    }

    return {
      ...base,
      adminDevices: admin.count ?? 0,
      customerDevices: customer.count ?? 0,
      tableReadable: true,
      tableError: null,
    };
  } catch (error) {
    return {
      ...base,
      adminDevices: 0,
      customerDevices: 0,
      tableReadable: false,
      tableError: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * The one thing to go and do, in the admin's own terms.
 *
 * Ordered, because the checks depend on each other: there is no point telling
 * somebody to register a device when the server has no keys, since the button
 * that would do it is not on the screen.
 */
export function pushNextStep(status: PushStatus): string | null {
  if (!status.tableReadable) {
    return "The push_subscriptions table could not be read. Run supabase/migrations/0012_push_subscriptions.sql.";
  }
  if (!status.configured) {
    return "Set WEB_PUSH_PUBLIC_KEY and WEB_PUSH_PRIVATE_KEY on the Worker, then redeploy. Until both are set the Enable button does not appear on the dashboard.";
  }
  if (status.adminDevices === 0) {
    return "No device is registered. Open the dashboard on the phone you want to be notified on and press Enable new request notifications. On an iPhone this only works from a copy added to the Home Screen, not a Safari tab.";
  }
  if (!status.chaserConfigured) {
    return `New requests will notify, but nothing chases the ones nobody opens. Set CRON_SECRET and point a scheduler at /api/cron/chase-submissions every few minutes to be reminded after ${status.chaserAfterMinutes} minutes.`;
  }
  return null;
}
