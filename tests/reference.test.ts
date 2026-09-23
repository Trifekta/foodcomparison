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
   * "Rare", which is what the keyspace actually promises - not "never", which
   * is what this used to assert and what no random generator can deliver.
   *
   * Six characters from a thirty-character alphabet is 30^6 = 729,000,000
   * references. Draw five thousand and the birthday paradox puts the chance of
   * at least one repeat at 1 - e^-(5000^2 / (2 x 729,000,000)), which is about
   * 1.7%. So `toBe(5000)` was a coin that came up tails on roughly one CI run
   * in fifty-nine, for a generator working exactly as designed - and a test
   * that fails for no reason teaches everybody to re-run it, which is how a
   * real failure gets waved through.
   *
   * Three collisions is the line. The expected number here is 0.017, so
   * exceeding it by chance is vanishingly unlikely; at five characters the
   * expectation is 0.5, and at four it is fifteen. A reference quietly
   * shortened still fails this, which is the regression worth catching.
   */
  it("spreads widely enough that collisions stay rare", () => {
    const draws = 5000;
    const seen = new Set(Array.from({ length: draws }, () => generateReferenceNumber()));

    expect(seen.size).toBeGreaterThanOrEqual(draws - 3);
    for (const reference of seen) expect(isValidReferenceNumber(reference)).toBe(true);
  });

  /**
   * The same promise, tested by counting the alphabet rather than by rolling
   * dice five thousand times. Deterministic: it cannot flake, and it fails the
   * moment somebody shortens the reference or trims the alphabet, whichever
   * way the random draw happens to land that day.
   */
  it("keeps a keyspace large enough for that to hold", () => {
    const alphabet = new Set(
      Array.from({ length: 2000 }, () => generateReferenceNumber()).join(""),
    );
    const length = generateReferenceNumber().length;

    expect(alphabet.size).toBe(30);
    expect(length).toBe(6);
    expect(alphabet.size ** length).toBeGreaterThan(500_000_000);
  });
});
