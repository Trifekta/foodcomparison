import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * POST /api/events tags a funnel step with the app that sent it - and only then.
 *
 * The website never sends X-SnipSavor-Client, and its insert must stay exactly
 * what it was: naming a column migration 0030 adds would make every web event
 * fail on a database that has not run it, silently, since this endpoint
 * swallows its errors by design.
 */

const inserts: Array<{ table: string; row: Record<string, unknown> }> = [];

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from(table: string) {
      return {
        insert(row: Record<string, unknown>) {
          inserts.push({ table, row });
          return Promise.resolve({ error: null });
        },
        upsert: () => Promise.resolve({ error: null }),
        select: () => ({
          eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }),
        }),
      };
    },
  }),
}));

const { POST } = await import("@/app/api/events/route");

let address = 0;

function event(client?: string): Request {
  address += 1;
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-forwarded-for": `10.5.${address >> 8}.${address & 255}`,
  };
  if (client) headers["x-snipsavor-client"] = client;
  return new Request("https://example.test/api/events", {
    method: "POST",
    headers,
    body: JSON.stringify({ event: "wizard_started", visitId: "0123456789abcdef" }),
  });
}

function funnelRow(): Record<string, unknown> {
  return inserts.find((entry) => entry.table === "funnel_events")?.row ?? {};
}

beforeEach(() => {
  inserts.length = 0;
});

describe("POST /api/events client tagging", () => {
  it("leaves a website event exactly as it was", async () => {
    expect((await POST(event())).status).toBe(204);
    expect(funnelRow()).toEqual({
      event: "wizard_started",
      visit_id: "0123456789abcdef",
      submission_id: null,
      area_id: null,
    });
  });

  it("tags an app's event with its platform and version", async () => {
    expect((await POST(event("android/1.0.4"))).status).toBe(204);
    expect(funnelRow()).toMatchObject({ client_platform: "android", app_version: "1.0.4" });
  });

  it("ignores a malformed header rather than guessing", async () => {
    await POST(event("android/latest"));
    expect(funnelRow()).not.toHaveProperty("client_platform");
  });
});
