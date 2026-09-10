import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * What a customer's result link is allowed to show.
 *
 * The token in that URL is the whole of the authorisation, so the test that
 * matters most is not "does it render" but "what is in the payload" - a link
 * gets forwarded, screenshotted and pasted into group chats, and the row it
 * reads from carries an admin's private notes, the customer's phone number and
 * the storage paths of their screenshots.
 */

const TOKEN = "0123456789abcdef0123456789abcdef";

let submission: Record<string, unknown> | null = null;
let items: Array<Record<string, unknown>> = [];
const queriedTokens: unknown[] = [];

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from(table: string) {
      return {
        select() {
          return {
            eq(_column: string, value: unknown) {
              if (table === "submissions") {
                queriedTokens.push(value);
                return { maybeSingle: () => Promise.resolve({ data: submission, error: null }) };
              }
              return {
                order: () => Promise.resolve({ data: items, error: null }),
              };
            },
          };
        },
      };
    },
  }),
}));

const { getPublicResult } = await import("@/lib/submissions/result");

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    reference_number: "FFA-260910-0042",
    status: "result_ready",
    restaurant_name: "Mandarin Oak",
    current_total: "34.65",
    comparison_app: "Keeta",
    comparison_total: "29.00",
    saving_amount: "5.65",
    saving_percentage: "16.31",
    comparison_url: "https://keeta.example/restaurant/123",
    created_at: "2026-09-10T10:15:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  submission = row();
  items = [{ name: "Wok Box", quantity: 1, line_price_minor: 2800 }];
  queriedTokens.length = 0;
});

describe("getPublicResult", () => {
  it("never queries on a token that is not shaped like one", async () => {
    // Cheaper than a round trip, and it keeps anything odd out of the query.
    expect(await getPublicResult("FFA-260910-0042")).toBeNull();
    expect(await getPublicResult("")).toBeNull();
    expect(queriedTokens).toHaveLength(0);
  });

  it("returns nothing for a token that matches no submission", async () => {
    submission = null;
    expect(await getPublicResult(TOKEN)).toBeNull();
  });

  it("shows both prices and the saving once the comparison is saved", async () => {
    const result = await getPublicResult(TOKEN);
    expect(result).toMatchObject({
      state: "saving",
      currentTotal: "34.65",
      comparisonTotal: "29.00",
      savingAmount: "5.65",
      savingPercentage: 16,
    });
  });

  it("carries nothing private, however far the link travels", async () => {
    submission = row({
      admin_notes: "customer sounded annoyed",
      whatsapp_number: "+971501234567",
      email: "someone@example.com",
      cart_image_path: "submissions/abc/cart.png",
      comparison_location_note: "Karama Test 01",
    });

    const serialised = JSON.stringify(await getPublicResult(TOKEN));
    for (const secret of [
      "annoyed",
      "+971501234567",
      "someone@example.com",
      "cart.png",
      "Karama Test 01",
    ]) {
      expect(serialised).not.toContain(secret);
    }
  });

  it("withholds the comparison price until there is one to give", async () => {
    // A half-finished comparison is not a result. Showing a Keeta total the
    // moment an admin starts typing would quote a number nobody has checked.
    submission = row({ status: "reviewing", comparison_total: null, saving_amount: null });
    const result = await getPublicResult(TOKEN);
    expect(result).toMatchObject({ state: "checking", comparisonTotal: null, savingAmount: null });
  });

  it("treats a saved comparison as an answer before anyone presses send", async () => {
    submission = row({ status: "comparison_found" });
    expect((await getPublicResult(TOKEN))?.state).toBe("saving");
  });

  it("says so plainly when the basket was not cheaper", async () => {
    submission = row({ status: "no_saving", comparison_total: "36.00", saving_amount: "0.00" });
    const result = await getPublicResult(TOKEN);
    expect(result).toMatchObject({ state: "no_saving", savingAmount: null, comparisonUrl: null });
  });

  it("does not offer a button to a link that is not https", async () => {
    // Typed by an admin, so this is a seatbelt rather than a trust boundary -
    // but a customer-facing page is the wrong place to find out.
    for (const bad of ["javascript:alert(1)", "http://keeta.example/x", "not a url", ""]) {
      submission = row({ comparison_url: bad });
      expect((await getPublicResult(TOKEN))?.comparisonUrl, `for ${bad}`).toBeNull();
    }
  });

  it("lists the items, so the basket can be rebuilt from the result", async () => {
    const result = await getPublicResult(TOKEN);
    expect(result?.items).toEqual([{ name: "Wok Box", quantity: 1, linePrice: "28.00" }]);
  });

  it("does not go looking for items while the answer is still pending", async () => {
    submission = row({ status: "new", comparison_total: null });
    expect((await getPublicResult(TOKEN))?.items).toEqual([]);
  });

  it("explains a cancelled request rather than leaving it spinning", async () => {
    submission = row({ status: "cancelled" });
    expect((await getPublicResult(TOKEN))?.state).toBe("cancelled");
  });
});
