import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { pushToAdmins } from "@/lib/push/send";
import { sendTelegramMessage, isTelegramConfigured } from "./telegram";
import { absoluteUrl } from "@/lib/env";
import { UNANSWERED_AFTER_MINUTES } from "@/lib/constants";

/**
 * Chasing the orders nobody has looked at.
 *
 * Everything else in this product notifies once, at the moment something
 * happens. That is fine when somebody is watching and useless when they are
 * not - and the one alert that matters most, "an order has arrived", is the one
 * most likely to be missed, because it lands while the admin is doing something
 * else. The result is a customer sitting out a five-minute promise nobody knows
 * they made.
 *
 * So this asks a different question on a schedule: not "what just happened" but
 * "what is still waiting". It is the only part of the system that can notice
 * silence.
 */

export interface UnansweredRow {
  id: string;
  reference_number: string;
  created_at: string;
  areas: { name: string } | null;
}

export interface ChaseOutcome {
  /** How many were still waiting and had not been chased before. */
  chased: number;
  /** The oldest wait in whole minutes, for the log line. */
  oldestMinutes: number;
}

/** Whole minutes a submission has been waiting. */
export function minutesWaiting(createdAt: string, now = Date.now()): number {
  const started = new Date(createdAt).getTime();
  if (Number.isNaN(started)) return 0;
  return Math.max(0, Math.floor((now - started) / 60_000));
}

/**
 * What to say about the ones that are waiting.
 *
 * One notification however many are waiting, not one each. Three orders arriving
 * at once is one thing to go and do, and three buzzes in a row is the fastest
 * way to teach somebody to ignore the buzzing.
 *
 * No customer detail, for the same reason as every other notification here: it
 * is rendered on a lock screen and passes through a push service. The area is
 * the most it carries, and only when a single order is waiting.
 */
export function composeChase(rows: UnansweredRow[], now = Date.now()): {
  title: string;
  body: string;
} {
  const oldest = rows.reduce(
    (max, row) => Math.max(max, minutesWaiting(row.created_at, now)),
    0,
  );

  if (rows.length === 1) {
    const area = rows[0].areas?.name?.trim();
    return {
      title: "Still waiting ⏳",
      body: area
        ? `A comparison from ${area} has been waiting ${oldest} minutes.`
        : `A comparison has been waiting ${oldest} minutes.`,
    };
  }

  return {
    title: "Still waiting ⏳",
    body: `${rows.length} comparisons are unanswered — the oldest for ${oldest} minutes.`,
  };
}

/**
 * Finds what is waiting, tells whoever is listening, and marks them chased.
 *
 * Marked after the notification rather than before: a chase that failed to send
 * should be tried again on the next run, not silently recorded as done. The
 * opposite order would turn one missed notification into a submission nobody is
 * ever reminded about.
 *
 * Archived rows are excluded. They are the ones somebody has already decided
 * are not real, and being chased about a test submission forever is exactly how
 * a reminder stops being read.
 */
export async function chaseUnansweredSubmissions(now = Date.now()): Promise<ChaseOutcome> {
  const supabase = createAdminClient();
  const cutoff = new Date(now - UNANSWERED_AFTER_MINUTES * 60_000).toISOString();

  const { data, error } = await supabase
    .from("submissions")
    .select("id, reference_number, created_at, areas(name)")
    .eq("status", "new")
    .is("chased_at", null)
    .is("archived_at", null)
    .lt("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(50);

  if (error) throw new Error(`Could not look for unanswered submissions: ${error.message}`);

  const rows = (data ?? []) as unknown as UnansweredRow[];
  if (rows.length === 0) return { chased: 0, oldestMinutes: 0 };

  const { title, body } = composeChase(rows, now);
  const oldestMinutes = minutesWaiting(rows[0].created_at, now);

  // Both channels, because they fail in different ways: push reaches a phone
  // with the browser shut but needs permission; Telegram needs neither but
  // needs the app. Whichever is configured does the job.
  await pushToAdmins({
    title,
    body,
    // The list, filtered to what is waiting - which is the screen somebody
    // should be looking at when they pick the phone up.
    url: "/admin?status=new",
    // One tag for all chasing, so a second reminder replaces the first rather
    // than stacking up a column of them.
    tag: "unanswered",
  });

  if (isTelegramConfigured()) {
    const link = absoluteUrl("/admin?status=new");
    await sendTelegramMessage(
      [title, "", body, ...(link ? ["", link] : [])].join("\n"),
    );
  }

  const { error: markError } = await supabase
    .from("submissions")
    .update({ chased_at: new Date(now).toISOString() })
    .in(
      "id",
      rows.map((row) => row.id),
    );

  if (markError) {
    // The notification went out; only the bookkeeping failed. Say so rather
    // than throwing, because the next run repeating one reminder is a far
    // smaller problem than a run that reports failure and gets retried.
    console.error("[chase] notified but could not mark them chased", {
      message: markError.message,
    });
  }

  return { chased: rows.length, oldestMinutes };
}
