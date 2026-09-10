import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getServiceRoleKey, getSupabaseUrl } from "@/lib/env";

/**
 * Service-role client. Bypasses RLS, so it is used in exactly two places:
 *
 *  1. the public submission endpoint, which must insert a row and upload to a
 *     private bucket on behalf of an anonymous customer;
 *  2. reading the active area list for the customer wizard, where we deliberately
 *     project away the internal test-location columns before it reaches the browser.
 *
 * This module is server-only and must never be imported from a client component.
 */
export function createAdminClient() {
  return createClient(getSupabaseUrl(), getServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
