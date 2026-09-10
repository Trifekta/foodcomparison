import { describe, expect, it } from "vitest";
import {
  formatReferenceDate,
  generateReferenceNumber,
  isValidReferenceNumber,
} from "@/lib/utils/reference";

describe("reference numbers", () => {
  it("uses the TRI-YYMMDD-NNNN shape", () => {
    const reference = generateReferenceNumber(new Date("2026-09-10T08:00:00Z"), () => 42);
    expect(reference).toBe("TRI-260910-0042");
    expect(isValidReferenceNumber(reference)).toBe(true);
  });

  it("formats the date part in UTC", () => {
    expect(formatReferenceDate(new Date("2026-01-05T23:30:00Z"))).toBe("260105");
  });

  it("rejects malformed references", () => {
    for (const bad of ["TRI-2609-0042", "tri-260910-0042", "TRI-260910-42", "", "0042"]) {
      expect(isValidReferenceNumber(bad)).toBe(false);
    }
  });

  it("produces unique references across many draws on the same day", () => {
    const date = new Date("2026-09-10T08:00:00Z");
    const seen = new Set<string>();
    for (let i = 0; i < 2000; i += 1) seen.add(generateReferenceNumber(date));

    // 4 random digits over 2000 draws: collisions are expected and handled by the
    // unique constraint + retry, but the generator must still spread widely.
    expect(seen.size).toBeGreaterThan(1500);
    for (const reference of seen) expect(isValidReferenceNumber(reference)).toBe(true);
  });
});
