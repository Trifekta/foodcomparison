import { describe, expect, it } from "vitest";
import {
  generateReferenceNumber,
  isValidReferenceNumber,
  normaliseReference,
} from "@/lib/utils/reference";

/**
 * The reference is the handle a person quotes, not a key to anything. These
 * tests are mostly about the shape of it being kind to a human: short enough to
 * read aloud, and made only of characters nobody mistypes for each other.
 */

describe("reference numbers", () => {
  it("is six characters, and that is the whole of it", () => {
    const reference = generateReferenceNumber(() => 0);
    expect(reference).toBe("222222");
    expect(reference).toHaveLength(6);
    expect(isValidReferenceNumber(reference)).toBe(true);
  });

  it("never uses a character people confuse for another", () => {
    // 0/O and 1/I/L are the classic pairs; U is left out so no reference spells
    // something the customer would rather not read back to us.
    const seen = new Set(Array.from({ length: 4000 }, () => generateReferenceNumber()).join(""));
    for (const banned of ["0", "1", "I", "L", "O", "U"]) {
      expect(seen.has(banned), `expected no ${banned}`).toBe(false);
    }
  });

  it("rejects anything that is not a reference", () => {
    for (const bad of [
      "",
      "ABC12",
      "ABC1234",
      "FFA-260910-0042",
      "ABCI23",
      "abc234",
      "AB C23",
    ]) {
      expect(isValidReferenceNumber(bad), `expected ${bad} to be rejected`).toBe(false);
    }
  });

  it("accepts it back however a person types it", () => {
    const reference = generateReferenceNumber();
    for (const typed of [reference.toLowerCase(), ` ${reference} `, `${reference}.`]) {
      expect(isValidReferenceNumber(normaliseReference(typed))).toBe(true);
      expect(normaliseReference(typed)).toBe(reference);
    }
  });

  it("spreads widely enough that collisions stay rare", () => {
    const seen = new Set(Array.from({ length: 5000 }, () => generateReferenceNumber()));
    expect(seen.size).toBe(5000);
    for (const reference of seen) expect(isValidReferenceNumber(reference)).toBe(true);
  });
});
