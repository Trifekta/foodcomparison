import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { normaliseAdminPath } from "@/lib/analytics/admin-activity";
import { dubaiIsoDate } from "@/lib/utils/text";

/**
 * Recording that an admin used the dashboard.
 *
 * Called from requireAdmin(), which is the one thing every admin page, route
 * handler and server action already goes through - so a new page is in the log
 * the moment it exists, with nobody having to remember to instrument it. That
 * is the whole reason it hangs off the guard rather than off a layout: a layout
 * misses route handlers and server actions, and any explicit call site misses
 * whatever is written next.
 *
 * Through the SERVICE ROLE, not the admin's own session. The row is a statement
 * about the person making the request, and a person who could write it could
 * also shape it - the table has no insert or update policy for admins at all
 * (see migration 0024), so this is the only way in. It is also why the admin id
 * is taken from the already-verified session and never from anything the
 * request could set.
 */

/**
 * Never the reason an admin page fails.
 *
 * Same rule the customer funnel follows: counting is worth less than the screen
 * it is counting. A dropped write costs one row in a log; a thrown error here
 * would take down every admin page at once, because requireAdmin() guards all
 * of them. Errors are swallowed rather than surfaced for exactly that reason.
 */
export async function recordAdminUse(adminId: string, path: string | null): Promise<void> {
  const section = normaliseAdminPath(path);
  if (!section) return;

  try {
    await createAdminClient().rpc("record_admin_activity", {
      p_admin_id: adminId,
      p_day: dubaiIsoDate(),
      p_path: section,
    });
  } catch {
    // Logged nowhere on purpose: this runs on every admin request, so a
    // persistent failure (the migration not yet applied, say) would otherwise
    // write a line of noise per request for as long as it lasted.
  }
}
