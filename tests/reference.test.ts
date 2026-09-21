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

  /**
   * Rare, which is not the same as impossible - and this asserted impossible.
   *
   * 5000 draws from 30^6 references expect 0.017 collisions between them, so
   * about one run in sixty of a generator working exactly as designed went
   * red. Measured over 120 trials the generator is uniform: every character
   * appears at every position, chi-squared well inside the 99.9% bound, and
   * collisions arrive at the rate the arithmetic predicts. The test was the
   * broken part, and a flaky test is worse here than no test, because CI now
   * gates the deploy.
   *
   * Three or more collisions is about one run in a million, and anything that
   * had really lost its spread - a constant, a collapsed alphabet, a modulo
   * over the wrong range - produces far more than three.
   */
  it("spreads widely enough that collisions stay rare", () => {
    const draws = 5000;
    const seen = new Set(Array.from({ length: draws }, () => generateReferenceNumber()));

    expect(draws - seen.size).toBeLessThanOrEqual(2);
    for (const reference of seen) expect(isValidReferenceNumber(reference)).toBe(true);
  });
});
