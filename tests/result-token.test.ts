import { describe, expect, it } from "vitest";
import {
  generateReferenceNumber,
  generateResultToken,
  isValidResultToken,
  resultPath,
} from "@/lib/utils/reference";

/**
 * A submission has two identifiers and they do different jobs.
 *
 * The reference number is the handle a person quotes back at us. The result
 * token is the key to a page showing their basket, their price and their
 * saving. These tests are about why the first cannot be used for the second.
 */

describe("result tokens", () => {
  it("is long enough that guessing is not a strategy", () => {
    // 32 hex characters is 128 bits. The reference number, by contrast, is a
    // date plus four digits: ten thousand possibilities a day.
    const token = generateResultToken();
    expect(token).toMatch(/^[0-9a-f]{32}$/);
    expect(generateReferenceNumber()).toMatch(/^FFA-\d{6}-\d{4}$/);
  });

  it("does not repeat itself", () => {
    const seen = new Set(Array.from({ length: 2000 }, () => generateResultToken()));
    expect(seen.size).toBe(2000);
  });

  it("rejects anything that is not exactly a token", () => {
    for (const bad of [
      "",
      "FFA-260910-0042",
      "0123456789abcdef0123456789abcde",
      "0123456789abcdef0123456789abcdef0",
      "0123456789ABCDEF0123456789abcdef",
      "../../etc/passwd",
      "0123456789abcdef0123456789abcde'",
    ]) {
      expect(isValidResultToken(bad), `expected ${bad} to be rejected`).toBe(false);
    }
  });

  it("accepts one it just made", () => {
    expect(isValidResultToken(generateResultToken())).toBe(true);
  });

  it("builds a relative path, so the link works on any host", () => {
    expect(resultPath("0123456789abcdef0123456789abcdef")).toBe(
      "/r/0123456789abcdef0123456789abcdef",
    );
  });
});
