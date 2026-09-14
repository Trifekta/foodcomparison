import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The switch, end to end.
 *
 * Two promises are being kept here at once and they pull in opposite
 * directions: every tap must be written down, and no customer may ever be
 * stranded between our page and the restaurant they were going to. So the tests
 * that matter most are the ones where the database misbehaves - the redirect
 * still has to happen - and the one where the destination is wrong, which is
 * the only case where it must not.
 */

process.env.KEETA_ALLOWED_HOSTS = "keeta.com";

const TOKEN = "0123456789abcdef0123456789abcdef";
const SUBMISSION_ID = "11111111-1111-4111-8111-111111111111";
const VISIT = "a1b2c3d4e5f60718";

let submission: Record<string, unknown> | null = null;
let insertError: { message: string } | null = null;
let insertThrows = false;
let inserted: Record<string, unknown>[] = [];

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from(table: string) {
      if (table === "keeta_clicks") {
        return {
          insert(row: Record<string, unknown>) {
            if (insertThrows) throw new Error("connection reset");
            inserted.push(row);
            return Promise.resolve({ error: insertError });
          },
        };
      }
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: submission, error: null }),
          }),
        }),
      };
    },
  }),
}));

const { GET } = await import("@/app/go/[token]/route");

function comparison(overrides: Record<string, unknown> = {}) {
  return {
    id: SUBMISSION_ID,
    restaurant_name: "Al Safadi",
    source_app: "Talabat",
    source_app_other: null,
    area_id: "22222222-2222-4222-8222-222222222222",
    current_total: "74.00",
    comparison_total: "58.00",
    saving_percentage: "21.62",
    comparison_url: "https://keeta.com/restaurant/9911",
    areas: { name: "Dubai Marina" },
    ...overrides,
  };
}

/** Calls the route the way Next does, with the token already resolved. */
function tap(token = TOKEN, query = "") {
  const url = `https://snipsavor.trifekta.io/go/${token}${query}`;
  return GET(new Request(url, { headers: { "user-agent": "Safari/iPhone", referer: "https://snipsavor.trifekta.io/r/x" } }), {
    params: Promise.resolve({ token }),
  });
}

beforeEach(() => {
  submission = comparison();
  insertError = null;
  insertThrows = false;
  inserted = [];
});

describe("a valid switch", () => {
  it("redirects to the Keeta link, and does not cache the redirect", async () => {
    const response = await tap();

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://keeta.com/restaurant/9911");
    // A 301 would be cached by the browser, and every customer would count once
    // however many times they actually switched.
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("writes down what was on the screen when they decided", async () => {
    await tap(TOKEN, `?v=${VISIT}`);

    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      submission_id: SUBMISSION_ID,
      event: "switch_to_keeta_clicked",
      visit_id: VISIT,
      restaurant_name: "Al Safadi",
      source_app: "Talabat",
      area_name: "Dubai Marina",
      current_total: "74.00",
      comparison_total: "58.00",
      saving_amount: "16.00",
      saving_percentage: 22,
      keeta_cheaper: true,
      destination_url: "https://keeta.com/restaurant/9911",
      // A click is not an order, and nothing has looked for one.
      conversion_status: "unknown",
    });
    expect(String(inserted[0].click_ref)).toMatch(/^KCLK_[23456789ABCDEFGHJKMNPQRSTVWXYZ]{10}$/);
  });

  it("keeps the device and referrer that were already on the request", async () => {
    await tap();
    expect(inserted[0]).toMatchObject({
      user_agent: "Safari/iPhone",
      referrer: "https://snipsavor.trifekta.io/r/x",
    });
  });

  it("carries campaign values when the link has them", async () => {
    await tap(TOKEN, "?utm_source=meta&utm_medium=cpc&utm_campaign=dxb-nov&campaign_id=1234");
    expect(inserted[0]).toMatchObject({
      utm_source: "meta",
      utm_medium: "cpc",
      utm_campaign: "dxb-nov",
      campaign_id: "1234",
    });
  });

  /**
   * A report that counts "unique switchers" must not be movable by typing into
   * a URL, so a visit id of the wrong shape is dropped rather than stored.
   */
  it("ignores a visit id that is not the right shape", async () => {
    await tap(TOKEN, "?v=' OR 1=1--");
    expect(inserted[0].visit_id).toBeNull();
  });

  it("records no saving when Keeta was not cheaper", async () => {
    submission = comparison({ current_total: "58.00", comparison_total: "74.00" });
    await tap();
    expect(inserted[0]).toMatchObject({
      keeta_cheaper: false,
      saving_amount: null,
      saving_percentage: null,
    });
  });
});

describe("tapping more than once", () => {
  /**
   * Two taps are two rows and one visit. Both numbers are worth having: the
   * second is the honest denominator for "did they switch", the first says how
   * much hesitation there was. Nothing is deduplicated on the way in.
   */
  it("records every tap, with its own click id", async () => {
    await tap(TOKEN, `?v=${VISIT}`);
    await tap(TOKEN, `?v=${VISIT}`);
    await tap(TOKEN, `?v=${VISIT}`);

    expect(inserted).toHaveLength(3);
    expect(new Set(inserted.map((row) => row.click_ref)).size).toBe(3);
    expect(new Set(inserted.map((row) => row.visit_id))).toEqual(new Set([VISIT]));
  });
});

describe("when something is wrong", () => {
  it("never redirects to a destination that is not Keeta", async () => {
    submission = comparison({ comparison_url: "https://evil.test/login" });
    const response = await tap();

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("/go/unavailable");
    expect(response.headers.get("location")).not.toContain("evil.test");
    // Nothing is recorded either: there was no switch to Keeta to record.
    expect(inserted).toHaveLength(0);
  });

  it("cannot be used as an open redirect by anybody who can reach it", async () => {
    for (const hostile of [
      "https://evil.test/",
      "http://keeta.com/x",
      "https://keeta.com.evil.test/x",
      "https://keeta.com@evil.test/",
      "javascript:alert(1)",
    ]) {
      submission = comparison({ comparison_url: hostile });
      const response = await tap();
      expect(response.headers.get("location"), hostile).toContain("/go/unavailable");
    }
  });

  it("sends somebody somewhere safe when the comparison is gone", async () => {
    submission = null;
    const response = await tap();
    expect(response.headers.get("location")).toContain("/go/unavailable?why=unknown");
  });

  it("says nothing about which tokens exist", async () => {
    submission = null;
    const missing = await tap();
    const malformed = await tap("not-a-token");
    // A token nobody recognises and one that is the wrong shape get the same
    // answer, so nothing can be learned by trying.
    expect(malformed.headers.get("location")).toBe(missing.headers.get("location"));
  });

  it("explains a missing link differently from a blocked one", async () => {
    submission = comparison({ comparison_url: null });
    const response = await tap();
    expect(response.headers.get("location")).toContain("why=nolink");
  });

  /**
   * The rule that outranks everything else here. A click we failed to record is
   * a number missing from a report; a customer stopped on an error page is the
   * product not working.
   */
  it("still redirects when the database refuses the write", async () => {
    insertError = { message: 'relation "keeta_clicks" does not exist' };
    const response = await tap();
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://keeta.com/restaurant/9911");
  });

  it("still redirects when the database throws outright", async () => {
    insertThrows = true;
    const response = await tap();
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://keeta.com/restaurant/9911");
  });
});
