import type { Metadata } from "next";
import { ADMIN_ACTIVITY_DAYS, getAdminActivity } from "@/lib/admin/queries";
import { summariseAdminActivity } from "@/lib/analytics/admin-activity";
import { AdminActivityTable } from "@/components/admin/AdminActivityTable";

export const metadata: Metadata = {
  title: "Team activity",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Who used the dashboard, and which parts of it.
 *
 * The counterpart to Live: that page is about the people the adverts bring,
 * this one is about the people answering them. Between them the admin side
 * could say what was CHANGED (submission_events) but never that anyone had
 * been in at all - an admin who signed in, read the new orders and changed
 * nothing left no trace anywhere.
 *
 * Visiting this page records a row of its own, which is correct and worth
 * saying out loud on the page itself: a log that quietly exempted the screen
 * used to read it would be the one part of the dashboard nobody could audit.
 */
export default async function AdminActivityPage() {
  const days = summariseAdminActivity(await getAdminActivity());

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-bold text-ink-900">Team activity</h1>
        <p className="text-sm text-ink-500">The last {ADMIN_ACTIVITY_DAYS} days</p>
      </div>

      <p className="max-w-2xl text-sm text-ink-500">
        Every signed-in admin, the hours they were on the dashboard, and the sections they
        opened. The counts are server requests rather than page views — pages that refresh
        themselves, like Live, raise them on their own — so read them as which sections got
        used, not how many times somebody looked. Opening this page is recorded too.
      </p>

      <AdminActivityTable days={days} />
    </div>
  );
}
