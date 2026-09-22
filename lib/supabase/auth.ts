import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { recordAdminUse } from "@/lib/admin/activity";
import { ADMIN_PATH_HEADER } from "@/lib/analytics/admin-path-header";
import type { AdminProfileRow } from "@/types/database";

export interface AdminSession {
  user: User;
  profile: AdminProfileRow;
}

/**
 * Resolves the current admin, or null.
 *
 * Being signed in is not enough: the user must also have a row in
 * admin_profiles. That table is what RLS keys off, so a stray Supabase account
 * cannot read submissions even if it somehow reaches an admin URL.
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("admin_profiles")
    .select("id, display_name, role, created_at")
    .eq("id", user.id)
    .maybeSingle<AdminProfileRow>();

  if (!profile) return null;

  return { user, profile };
}

/**
 * Once per request, however many times requireAdmin() is called in it.
 *
 * A page render calls the guard from the layout and again from the page, and a
 * route handler may call it beside either; without this, one navigation would
 * count as two or three. React's cache() is keyed on the argument, so the
 * second and third calls in the same request get the first one's promise rather
 * than a second write.
 *
 * It only collapses duplicates WITHIN a request, which is the honest limit:
 * hits still counts requests, and an auto-refreshing page still makes them.
 *
 * Wrapped in its own catch as well as the one inside recordAdminUse, because
 * reading the header can fail before that is ever reached - headers() throws
 * wherever there is no request to read. requireAdmin() guards every admin page
 * at once, so nothing it does on the way to returning a session may be allowed
 * to throw: the log is worth less than the dashboard it describes.
 */
const recordUseOnce = cache(async (adminId: string): Promise<void> => {
  try {
    const path = (await headers()).get(ADMIN_PATH_HEADER);
    await recordAdminUse(adminId, path);
  } catch {
    // No request context, or no header. Nothing is recorded and the admin
    // notices nothing, which is the correct order of priorities here.
  }
});

/**
 * Server-side guard for every admin route. Redirects instead of rendering.
 *
 * Also where admin use is recorded, because this is the only thing every admin
 * page, route handler and server action already has in common - see
 * lib/admin/activity.ts. Recorded AFTER the check, never before: a request that
 * is turned away is not somebody using the dashboard, and logging it here would
 * put anonymous traffic in a table about named people.
 *
 * Awaited rather than left in flight. It costs one round trip on admin requests
 * only, and the alternative loses rows to a response that returns first - this
 * runs on Workers, where work nobody is waiting on can be cancelled outright.
 */
export async function requireAdmin(returnTo?: string): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) {
    const target = returnTo ? `/admin/login?next=${encodeURIComponent(returnTo)}` : "/admin/login";
    redirect(target);
  }

  await recordUseOnce(session.user.id);
  return session;
}
