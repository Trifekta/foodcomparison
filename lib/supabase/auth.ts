import "server-only";

import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
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

/** Server-side guard for every admin route. Redirects instead of rendering. */
export async function requireAdmin(returnTo?: string): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) {
    const target = returnTo ? `/admin/login?next=${encodeURIComponent(returnTo)}` : "/admin/login";
    redirect(target);
  }
  return session;
}
