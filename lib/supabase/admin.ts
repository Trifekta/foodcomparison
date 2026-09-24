import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getServiceRoleKey, getSupabaseUrl } from "@/lib/env";

/**
 * Service-role client. Bypasses RLS for public writes and for admin actions on
 * tables that expose read-only policies. Admin actions must call requireAdmin()
 * before using this client. This module must never enter a client component.
 */
export function createAdminClient() {
  return createClient(getSupabaseUrl(), getServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
