"use server";

import { revalidatePath } from "next/cache";
import { isValidVisitId } from "@/lib/analytics/funnel";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/supabase/auth";

interface DeleteVisitResult {
  ok: boolean;
  message?: string;
}

/** Remove one visit from history and its supporting presence/IP rows. */
export async function deleteVisit(visitId: string): Promise<DeleteVisitResult> {
  // The service-role client below bypasses RLS, so check the admin session
  // before creating it or touching any visit data.
  await requireAdmin("/admin/live/visits");
  if (!isValidVisitId(visitId)) {
    return { ok: false, message: "That visit ID is invalid." };
  }

  try {
    const supabase = createAdminClient();
    // Events go last. If an earlier delete fails, the visit remains visible
    // and the admin can retry. None of these tables owns a submission.
    for (const [table, label] of [
      ["visitor_ips", "IP validation record"],
      ["visit_presence", "live presence"],
      ["funnel_events", "event history"],
    ] as const) {
      const { error } = await supabase.from(table).delete().eq("visit_id", visitId);
      if (error) {
        return {
          ok: false,
          message: `Could not remove the ${label}. Some visit data may already be gone; please try again.`,
        };
      }
    }

    for (const path of ["/admin/live/visits", "/admin/live", "/admin/analytics", "/admin"]) {
      revalidatePath(path);
    }
    return { ok: true };
  } catch {
    return { ok: false, message: "Could not delete this visit. Please try again." };
  }
}
