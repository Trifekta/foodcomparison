import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { AreaRow, PublicArea } from "@/types/database";

/**
 * Active areas for the customer wizard.
 *
 * Read with the service role and projected down to the four safe columns before
 * it ever reaches the browser: the areas table also holds internal
 * test-location notes and coordinates that customers must never see.
 *
 * No city filter. This used to return Dubai only, which meant a customer
 * anywhere else opened a dropdown they could not answer - and the area is
 * required, so that was the end of their visit. Which areas are offered is now
 * decided by the `active` flag alone, one switch, in one place, that an admin
 * can already reach from /admin/areas.
 *
 * Ordered by sort_order and then name so the grouping the customer sees comes
 * out of the database rather than being re-derived in the browser. The groups
 * are ordered by giving every area in one a shared sort_order - see migration
 * 0017 - which leaves Dubai's original 10-470 at the top where the ads point.
 */
export async function getPublicAreas(): Promise<PublicArea[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("areas")
    .select("id, name, city, emirate")
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Could not load areas: ${error.message}`);
  }

  return (data ?? []) as PublicArea[];
}

/**
 * An admin's full area row, cut down to what a browser may see.
 *
 * The admin pages already hold every column - including the internal test
 * address and coordinates - so the projection has to happen somewhere, and it
 * happens here rather than being spelled out at each call site. Adding a public
 * column is then one edit, not a hunt for the places that forgot.
 */
export function toPublicArea(area: AreaRow): PublicArea {
  return { id: area.id, name: area.name, city: area.city, emirate: area.emirate };
}
