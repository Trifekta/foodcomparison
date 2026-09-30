import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * POST /api/v1/submissions, and that the website's route did not change.
 *
 * Both routes run the real createSubmission() against a fake Supabase, so what
 * is pinned is the whole path: the app's platform and version reach the row,
 * the website's insert never names the new columns (it must keep working on a
 * database without 0030), failures carry codes, and the web response keeps its
 * exact old shape.
 */

const AREA_ID = "3f7d6d1a-6d8b-4c2f-9d51-3c9e2b7f1a55";

const inserts: Array<{ table: string; rows: unknown }> = [];
let areaActive = true;

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from(table: string) {
      return {
        insert(rows: unknown) {
          inserts.push({ table, rows });
          return Promise.resolve({ error: null });
        },
        select() {
          return {
            eq() {
              return {
                maybeSingle: () =>
                  Promise.resolve({
                    data: { id: AREA_ID, active: areaActive, name: "Al Karama" },
                    error: null,
                  }),
              };
            },
          };
        },
      };
    },
    storage: {
      from: () => ({
        upload: () => Promise.resolve({ error: null }),
        remove: () => Promise.resolve({ error: null }),
      }),
    },
  }),
}));

vi.mock("@/lib/notifications/admin-alert", () => ({
  alertAdminOfNewSubmission: async () => {},
}));

vi.mock("@/lib/push/send", () => ({
  pushToAdmins: async () => ({ attempted: 0, delivered: 0, failures: [] }),
}));

vi.mock("@/lib/drafts/complete", () => ({
  completeDraftAfterSubmission: async () => {},
}));

const { POST: postV1 } = await import("@/app/api/v1/submissions/route");
const { POST: postWeb } = await import("@/app/api/submissions/route");

function pngFile(): File {
  const bytes = new Uint8Array(32);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return new File([bytes], "cart.png", { type: "image/png" });
}

function form(overrides: Record<string, string> = {}, cart: File | null = pngFile()): FormData {
  const body = new FormData();
  if (cart) body.append("cartImage", cart);
  const fields: Record<string, string> = {
    restaurantName: "Al Safadi",
    areaId: AREA_ID,
    currentTotal: "82.00",
    newToKeeta: "no",
    dialCode: "+971",
    whatsappNumber: "501234567",
    marketingConsent: "false",
    ...overrides,
  };
  for (const [key, value] of Object.entries(fields)) body.append(key, value);
  return body;
}

let address = 0;

function request(
  path: string,
  body: FormData,
  client: string | null = "android/1.0.0",
): Request {
  // A fresh address per request, so one test's rate-limit budget is not another's.
  address += 1;
  const headers: Record<string, string> = { "x-forwarded-for": `10.9.${address >> 8}.${address & 255}` };
  if (client !== null) headers["x-snipsavor-client"] = client;
  return new Request(`https://example.test${path}`, { method: "POST", body, headers });
}

function submissionRow(): Record<string, unknown> {
  return (inserts.find((row) => row.table === "submissions")?.rows ?? {}) as Record<string, unknown>;
}

beforeEach(() => {
  inserts.length = 0;
  areaActive = true;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/v1/submissions", () => {
  it("creates the submission and returns the token and absolute link", async () => {
    const response = await postV1(request("/api/v1/submissions", form()));
    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("no-store");

    const { data } = await response.json();
    expect(data.referenceNumber).toMatch(/^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{6}$/);
    expect(data.resultToken).toMatch(/^[0-9a-f]{32}$/);
    expect(data.resultPath).toBe(`/r/${data.resultToken}`);
    expect(data.resultUrl).toBe(`https://example.test/r/${data.resultToken}`);
    // The token in the reply is the one written to the row.
    expect(submissionRow().result_token).toBe(data.resultToken);
  });

  it("records the app's platform and version on the row", async () => {
    await postV1(request("/api/v1/submissions", form(), "ios/2.3.1"));
    expect(submissionRow()).toMatchObject({ client_platform: "ios", app_version: "2.3.1" });
  });

  it("refuses a caller that does not name itself, before touching anything", async () => {
    const response = await postV1(request("/api/v1/submissions", form(), null));
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("client_required");
    expect(inserts).toHaveLength(0);
  });

  it("refuses a build below the platform minimum with 426", async () => {
    vi.stubEnv("MOBILE_MIN_VERSION_ANDROID", "1.5.0");
    const response = await postV1(request("/api/v1/submissions", form(), "android/1.4.9"));
    expect(response.status).toBe(426);
    expect((await response.json()).error.code).toBe("upgrade_required");
    expect(inserts).toHaveLength(0);
  });

  it("does not gate the other platform on that minimum", async () => {
    vi.stubEnv("MOBILE_MIN_VERSION_ANDROID", "1.5.0");
    const response = await postV1(request("/api/v1/submissions", form(), "ios/1.0.0"));
    expect(response.status).toBe(201);
  });

  it.each([
    ["a missing cart screenshot", form({}, null), "cart_image_missing", "cartImage"],
    [
      "an image that is not one",
      form({}, new File([new Uint8Array(32).fill(65)], "cart.png", { type: "image/png" })),
      "image_unsupported",
      "cartImage",
    ],
    ["a bad total", form({ currentTotal: "abc" }), "invalid_field", "currentTotal"],
    ["bad item JSON", form({ items: "{not json" }), "invalid_items", "items"],
  ])("answers %s with a code and the field", async (_label, body, code, field) => {
    const response = await postV1(request("/api/v1/submissions", body));
    expect(response.status).toBe(400);
    const { error } = await response.json();
    expect(error.code).toBe(code);
    expect(error.field).toBe(field);
    expect(typeof error.message).toBe("string");
  });

  it("says area_unavailable for a switched-off area", async () => {
    areaActive = false;
    const response = await postV1(request("/api/v1/submissions", form()));
    expect((await response.json()).error).toMatchObject({ code: "area_unavailable", field: "areaId" });
  });

  it("says payload_too_large before reading the body", async () => {
    const response = await postV1(
      new Request("https://example.test/api/v1/submissions", {
        method: "POST",
        body: "x",
        headers: {
          "x-snipsavor-client": "android/1.0.0",
          "x-forwarded-for": "10.8.0.1",
          "content-length": String(30 * 1024 * 1024),
        },
      }),
    );
    expect(response.status).toBe(413);
    expect((await response.json()).error.code).toBe("payload_too_large");
  });

  it("shares the website's rate-limit budget rather than adding a second one", async () => {
    const headers = { "x-forwarded-for": "10.7.0.1" };
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const web = await postWeb(
        new Request("https://example.test/api/submissions", { method: "POST", body: form(), headers }),
      );
      statuses.push(web.status);
    }
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const app = await postV1(
        new Request("https://example.test/api/v1/submissions", {
          method: "POST",
          body: form(),
          headers: { ...headers, "x-snipsavor-client": "android/1.0.0" },
        }),
      );
      statuses.push(app.status);
    }
    // Five per window in total, across both doors.
    expect(statuses).toEqual([201, 201, 201, 201, 201, 429]);
  });
});

describe("POST /api/submissions (website) is unchanged", () => {
  it("keeps its response shape", async () => {
    const response = await postWeb(request("/api/submissions", form(), null));
    expect(response.status).toBe(201);
    const payload = await response.json();
    expect(Object.keys(payload).sort()).toEqual(["referenceNumber", "resultPath"]);
    expect(payload.resultPath).toMatch(/^\/r\/[0-9a-f]{32}$/);
  });

  it("never names the client columns, so it works without migration 0030", async () => {
    await postWeb(request("/api/submissions", form(), null));
    expect(submissionRow()).not.toHaveProperty("client_platform");
    expect(submissionRow()).not.toHaveProperty("app_version");
  });

  it("ignores a client header rather than acting on it", async () => {
    await postWeb(request("/api/submissions", form(), "android/1.0.0"));
    expect(submissionRow()).not.toHaveProperty("client_platform");
  });

  it("keeps its old error shape", async () => {
    const response = await postWeb(request("/api/submissions", form({}, null), null));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Please upload a screenshot of your cart.",
      field: "cartImage",
    });
  });
});
