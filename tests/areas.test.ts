import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { emirateForCity, LAUNCH_CITY, UAE_REGIONS } from "@/lib/constants";
import { filterAreas, groupAreasByCity } from "@/lib/area-groups";
import type { PublicArea } from "@/types/database";

const area = (name: string, city: string, emirate = city): PublicArea => ({
  id: `${city}-${name}`.toLowerCase().replace(/\s+/g, "-"),
  name,
  city,
  emirate,
});

/** Roughly what getPublicAreas returns: ordered by group, then by name. */
const areas: PublicArea[] = [
  area("Al Nahda Dubai", "Dubai"),
  area("Dubai Marina", "Dubai"),
  area("Al Bateen", "Abu Dhabi"),
  area("Yas Island", "Abu Dhabi"),
  area("Al Jimi", "Al Ain", "Abu Dhabi"),
  area("Zakher", "Al Ain", "Abu Dhabi"),
  area("Al Majaz", "Sharjah"),
  area("Al Nahda", "Sharjah"),
];

describe("emirateForCity", () => {
  it("knows Al Ain is legally Abu Dhabi, though nobody there calls it that", () => {
    expect(emirateForCity("Al Ain")).toBe("Abu Dhabi");
  });

  it("returns the emirate for a city that is one", () => {
    expect(emirateForCity("Sharjah")).toBe("Sharjah");
    expect(emirateForCity(LAUNCH_CITY)).toBe("Dubai");
  });

  it("falls back to the city rather than guessing Dubai", () => {
    // A row that is merely incomplete beats one that is confidently wrong in
    // the column the funnel report groups by.
    expect(emirateForCity("Hatta")).toBe("Hatta");
  });

  it("covers all seven emirates exactly once", () => {
    const emirates = new Set(UAE_REGIONS.map((region) => region.emirate));
    expect([...emirates].sort()).toEqual([
      "Abu Dhabi",
      "Ajman",
      "Dubai",
      "Fujairah",
      "Ras Al Khaimah",
      "Sharjah",
      "Umm Al Quwain",
    ]);
  });

  it("offers Dubai first, because that is who the ads reach", () => {
    expect(UAE_REGIONS[0]?.city).toBe(LAUNCH_CITY);
  });
});

describe("filterAreas", () => {
  it("returns everything for an empty query", () => {
    expect(filterAreas(areas, "   ")).toHaveLength(areas.length);
  });

  it("matches the area name", () => {
    expect(filterAreas(areas, "marina").map((a) => a.name)).toEqual(["Dubai Marina"]);
  });

  it("matches the city, because people type where they live", () => {
    expect(filterAreas(areas, "sharjah").map((a) => a.name)).toEqual(["Al Majaz", "Al Nahda"]);
  });

  it("reaches Al Ain by its emirate, which its own heading does not say", () => {
    expect(filterAreas(areas, "abu dhabi").map((a) => a.name)).toEqual([
      "Al Bateen",
      "Yas Island",
      "Al Jimi",
      "Zakher",
    ]);
  });

  it("finds both Al Nahdas, which is why the heading is always shown", () => {
    const cities = filterAreas(areas, "al nahda").map((a) => a.city);
    expect(cities).toEqual(["Dubai", "Sharjah"]);
  });
});

describe("groupAreasByCity", () => {
  it("keeps the database's order of groups", () => {
    expect(groupAreasByCity(areas).map((group) => group.city)).toEqual([
      "Dubai",
      "Abu Dhabi",
      "Al Ain",
      "Sharjah",
    ]);
  });

  it("carries the emirate so Al Ain can show what it belongs to", () => {
    const alAin = groupAreasByCity(areas).find((group) => group.city === "Al Ain");
    expect(alAin?.emirate).toBe("Abu Dhabi");
  });

  it("gives every option its index in the flat list, which is what arrows walk", () => {
    const flat = groupAreasByCity(areas).flatMap((group) => group.options);
    expect(flat.map((option) => option.index)).toEqual(areas.map((_, index) => index));
    expect(flat.map((option) => option.area.name)).toEqual(areas.map((a) => a.name));
  });

  it("never splits one city into two headings, whatever the sort order did", () => {
    const interleaved = [
      area("Al Majaz", "Sharjah"),
      area("Dubai Marina", "Dubai"),
      area("Al Nahda", "Sharjah"),
    ];
    const groups = groupAreasByCity(interleaved);
    expect(groups.map((group) => group.city)).toEqual(["Sharjah", "Dubai"]);
    expect(groups[0]?.options).toHaveLength(2);
  });
});

/**
 * The seeded areas are data, but they are data the picker's grouping depends on:
 * a row whose emirate disagrees with its city puts a heading in the wrong place
 * and a submission in the wrong bucket in the funnel report.
 */
describe("the seeded UAE areas", () => {
  const sql = readFileSync(
    path.join(import.meta.dirname, "..", "supabase", "migrations", "0017_uae_areas.sql"),
    "utf8",
  );
  const rows = [...sql.matchAll(/\('([^']+)', '([^']+)', '([^']+)', true, (\d+)\)/g)].map((m) => ({
    name: m[1],
    city: m[2],
    emirate: m[3],
    sortOrder: Number(m[4]),
  }));

  it("seeds every group the picker offers, apart from Dubai's own seed", () => {
    const seeded = new Set(rows.map((row) => row.city));
    const expected = UAE_REGIONS.map((region) => region.city).filter((city) => city !== LAUNCH_CITY);
    expect([...seeded].sort()).toEqual([...expected].sort());
  });

  it("agrees with emirateForCity on every single row", () => {
    const wrong = rows.filter((row) => row.emirate !== emirateForCity(row.city));
    expect(wrong).toEqual([]);
  });

  it("has no duplicate area within a city, which the unique index would reject", () => {
    const keys = rows.map((row) => `${row.city}|${row.name}`);
    expect(keys).toHaveLength(new Set(keys).size);
  });

  it("gives every area in a group the same sort order, so names order them", () => {
    const orders = new Map<string, Set<number>>();
    for (const row of rows) {
      orders.set(row.city, (orders.get(row.city) ?? new Set()).add(row.sortOrder));
    }
    for (const [city, set] of orders) {
      expect({ city, distinct: set.size }).toEqual({ city, distinct: 1 });
    }
  });

  it("sorts every seeded group after Dubai, which tops the picker", () => {
    const dubaiMax = 470; // the highest sort_order in supabase/seed.sql
    expect(Math.min(...rows.map((row) => row.sortOrder))).toBeGreaterThan(dubaiMax);
  });
});
