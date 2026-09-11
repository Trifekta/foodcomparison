import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Finding an order again from a reference.
 *
 * The reference is six characters, which is short enough to read down a phone
 * and far too short to guard a basket and a price on its own. So these tests
 * are mostly about the second half: the contact the result was going to has to
 * match, and every kind of miss has to look identical from outside.
 */

let row: Record<string, unknown> | null = null;
const queried: unknown[] = [];

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: (_column: string, value: unknown) => {
          queried.push(value);
          return { maybeSingle: () => Promise.resolve({ data: row, error: null }) };
        },
      }),
    }),
  }),
}));

const { findResultPath } = await import("@/lib/submissions/result");

const TOKEN = "0123456789abcdef0123456789abcdef";

beforeEach(() => {
  row = {
    result_token: TOKEN,
    whatsapp_number: "+971501234567",
    email: null,
  };
  queried.length = 0;
});

describe("findResultPath", () => {
  it("returns the result when both halves match", async () => {
    expect(await findResultPath("K7M2QX", "501234567")).toBe(`/r/${TOKEN}`);
  });

  it("accepts the number however the customer types it", async () => {
    for (const typed of ["0501234567", "50 123 4567", "+971 50 123 4567", "971501234567"]) {
      expect(await findResultPath("K7M2QX", typed), `for ${typed}`).toBe(`/r/${TOKEN}`);
    }
  });

  it("accepts the reference however the customer types it", async () => {
    for (const typed of ["k7m2qx", " K7M2QX ", "K7M2QX."]) {
      expect(await findResultPath(typed, "501234567"), `for ${typed}`).toBe(`/r/${TOKEN}`);
    }
  });

  it("matches on email when that is where the result was going", async () => {
    row = { result_token: TOKEN, whatsapp_number: null, email: "Someone@Example.com" };
    expect(await findResultPath("K7M2QX", "someone@example.com")).toBe(`/r/${TOKEN}`);
  });

  it("refuses the right reference with the wrong contact", async () => {
    // The whole point. Someone working through six-character codes still has
    // nothing without the number the result was sent to.
    expect(await findResultPath("K7M2QX", "509999999")).toBeNull();
    expect(await findResultPath("K7M2QX", "someone@example.com")).toBeNull();
  });

  it("refuses a reference that does not exist", async () => {
    row = null;
    expect(await findResultPath("K7M2QX", "501234567")).toBeNull();
  });

  it("never queries on something that is not a reference", async () => {
    for (const bad of ["", "ABC", "K7M2QX1", "FFA-260910-0042", "K7M2QI"]) {
      expect(await findResultPath(bad, "501234567"), `for ${bad}`).toBeNull();
    }
    expect(queried).toHaveLength(0);
  });

  it("needs a contact at all", async () => {
    expect(await findResultPath("K7M2QX", "")).toBeNull();
    expect(await findResultPath("K7M2QX", "  ")).toBeNull();
  });

  it("looks up the tidied reference, not what was typed", async () => {
    await findResultPath(" k7m2qx ", "501234567");
    expect(queried).toEqual(["K7M2QX"]);
  });
});
