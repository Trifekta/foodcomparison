import type { PublicArea } from "@/types/database";

/**
 * Turning a flat list of areas into the list a customer reads.
 *
 * Kept out of the combobox because it is the part with rules in it - what
 * counts as a match, and what ends up under which heading - and a component in
 * a client bundle is not somewhere those can be tested.
 */

export interface GroupedOption {
  area: PublicArea;
  /** Position in the flat filtered list, which is what the arrow keys move through. */
  index: number;
}

export interface AreaGroup {
  city: string;
  emirate: string;
  options: GroupedOption[];
}

/**
 * Matched on the place as well as the area.
 *
 * Somebody in Sharjah types "sharjah", not "Al Majaz" - they are telling us
 * where they live, and the area names are the part they are trying to remember.
 * Matching the emirate too is what makes "abu dhabi" reach Al Ain, which is the
 * one group whose heading does not say so.
 */
export function matchesAreaQuery(area: PublicArea, needle: string): boolean {
  const query = needle.trim().toLowerCase();
  if (!query) return true;
  return (
    area.name.toLowerCase().includes(query) ||
    area.city.toLowerCase().includes(query) ||
    area.emirate.toLowerCase().includes(query)
  );
}

export function filterAreas(areas: PublicArea[], query: string): PublicArea[] {
  if (!query.trim()) return areas;
  return areas.filter((area) => matchesAreaQuery(area, query));
}

/**
 * The flat list, cut into its headings.
 *
 * Every option keeps the index it had in the flat list, because that is what
 * the arrow keys walk: navigation moves down the visible options and steps over
 * the headings, which is what a listbox is supposed to do.
 *
 * Collected into a Map rather than by consecutive runs, so an area whose
 * sort_order has been edited into the middle of another group cannot make its
 * own city appear as two separate headings. Group order follows first
 * appearance, which is the order the database returned.
 */
export function groupAreasByCity(areas: PublicArea[]): AreaGroup[] {
  const byCity = new Map<string, AreaGroup>();

  areas.forEach((area, index) => {
    const group = byCity.get(area.city) ?? { city: area.city, emirate: area.emirate, options: [] };
    group.options.push({ area, index });
    byCity.set(area.city, group);
  });

  return [...byCity.values()];
}
