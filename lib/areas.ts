import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { PublicArea } from "@/types/database";
import { LAUNCH_CITY } from "@/lib/constants";

/**
 * Active areas for the customer wizard.
 *
 * Read with the service role and projected down to {id, name} before it ever
 * reaches the browser: the areas table also holds internal test-location notes
 * that customers must never see.
 */
export async function getPublicAreas(): Promise<PublicArea[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("areas")
    .select("id, name")
    .eq("active", true)
    .eq("city", LAUNCH_CITY)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Could not load areas: ${error.message}`);
  }

  return (data ?? []) as PublicArea[];
}
