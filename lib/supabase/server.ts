import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/env";

/**
 * Request-scoped Supabase client that carries the signed-in admin's session.
 *
 * Every admin read and write goes through this client, so Row Level Security is
 * the thing that actually enforces access - not the UI.
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component render: the proxy refreshes the
          // session cookies instead, so this is safe to ignore.
        }
      },
    },
  });
}
