import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * GET /api/v1/results/:token and GET /api/v1/config.
 *
 * Both read through the same functions the website renders from -
 * getPublicResult() and getPublicAreas() - which are stubbed here, so what is
 * pinned is what the v1 layer adds: the envelope, the absolute links, the codes,
 * and the config route answering an outdated build instead of refusing it.
 */

const TOKEN = "0123456789abcdef0123456789abcdef";

let result: Record<string, unknown> | null = null;
let areasFail = false;

vi.mock("@/lib/submissions/result", () => ({
  getPublicResult: async (token: string) => (token === TOKEN ? result : null),
}));

vi.mock("@/lib/areas", () => ({
  getPublicAreas: async () => {
    if (areasFail) throw new Error("database is down");
    return [
      { id: "3f7d6d1a-6d8b-4c2f-9d51-3c9e2b7f1a55", name: "Al Karama", city: "Dubai", emirate: "Dubai" },
    ];
  },
}));

const { GET: getResult } = await import("@/app/api/v1/results/[token]/route");
const { GET: getConfig } = await import("@/app/api/v1/config/route");

let address = 0;

function get(path: string, client: string | null = "android/1.0.0"): Request {
  address += 1;
  const headers: Record<string, string> = { "x-forwarded-for": `10.6.${address >> 8}.${address & 255}` };
  if (client !== null) headers["x-snipsavor-client"] = client;
  return new Request(`https://example.test${path}`, { headers });
}

function params(token: string) {
  return { params: Promise.resolve({ token }) };
}

const SAVING_RESULT = {
  referenceNumber: "K7M2PQ",
  state: "saving",
  unavailableReason: null,
  restaurantName: "Al Safadi",
  currentTotal: "82.00",
  comparisonApp: "Keeta",
  comparisonTotal: "63.00",
  savingAmount: "19.00",
  savingPercentage: 23,
  switchPath: "/go/fedcba9876543210fedcba9876543210",
  items: [],
  totalsConfirmed: true,
  newToKeeta: false,
  createdAt: "2026-09-30T10:00:00.000Z",
};

beforeEach(() => {
  result = SAVING_RESULT;
  areasFail = false;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/v1/results/:token", () => {
  it("returns the public projection plus absolute links", async () => {
    const response = await getResult(get(`/api/v1/results/${TOKEN}`), params(TOKEN));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");

    const { data } = await response.json();
    expect(data).toMatchObject(SAVING_RESULT);
    expect(data.resultUrl).toBe(`https://example.test/r/${TOKEN}`);
    expect(data.switchUrl).toBe("https://example.test/go/fedcba9876543210fedcba9876543210");
  });

  it("has no switch link while there is nothing to switch to", async () => {
    result = { ...SAVING_RESULT, state: "checking", switchPath: null };
    const { data } = await (await getResult(get(`/api/v1/results/${TOKEN}`), params(TOKEN))).json();
    expect(data.switchUrl).toBeNull();
  });

  it("answers an unknown token with result_not_found", async () => {
    const other = "ffffffffffffffffffffffffffffffff";
    const response = await getResult(get(`/api/v1/results/${other}`), params(other));
    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("result_not_found");
  });

  it("requires the client header", async () => {
    const response = await getResult(get(`/api/v1/results/${TOKEN}`, null), params(TOKEN));
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("client_required");
  });

  it("refuses an outdated build", async () => {
    vi.stubEnv("MOBILE_MIN_VERSION_IOS", "3.0.0");
    const response = await getResult(get(`/api/v1/results/${TOKEN}`, "ios/2.9.9"), params(TOKEN));
    expect(response.status).toBe(426);
  });
});

describe("GET /api/v1/config", () => {
  it("returns what the website renders its pages from", async () => {
    const response = await getConfig(get("/api/v1/config", "android/1.2.0"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, max-age=60");

    const { data } = await response.json();
    expect(data.apiVersion).toBe(1);
    expect(data.client).toEqual({
      platform: "android",
      appVersion: "1.2.0",
      minimumVersion: "0.0.0",
      updateRequired: false,
    });
    expect(data.areas).toEqual([
      { id: "3f7d6d1a-6d8b-4c2f-9d51-3c9e2b7f1a55", name: "Al Karama", city: "Dubai", emirate: "Dubai" },
    ]);
    expect(data.comparisonApp).toBe("Keeta");
    expect(data.resultPromiseMinutes).toBe(5);
    expect(data.limits.acceptedImageTypes).toEqual(["image/jpeg", "image/png", "image/webp"]);
    expect(data.foodApps[0]).toEqual({
      name: "Talabat",
      url: "https://www.talabat.com/uae",
      logoUrl: "https://example.test/brands/talabat.png",
    });
    expect(data.links.privacy).toBe("https://example.test/privacy");
  });

  it("carries no internal area columns", async () => {
    const { data } = await (await getConfig(get("/api/v1/config"))).json();
    for (const area of data.areas) {
      expect(Object.keys(area).sort()).toEqual(["city", "emirate", "id", "name"]);
    }
  });

  it("still answers an outdated build, and tells it to update", async () => {
    vi.stubEnv("MOBILE_MIN_VERSION_ANDROID", "2.0.0");
    const response = await getConfig(get("/api/v1/config", "android/1.9.0"));
    expect(response.status).toBe(200);
    const { data } = await response.json();
    expect(data.client).toMatchObject({ minimumVersion: "2.0.0", updateRequired: true });
  });

  it("never gates the website", async () => {
    vi.stubEnv("MOBILE_MIN_VERSION_ANDROID", "2.0.0");
    const { data } = await (await getConfig(get("/api/v1/config", "web/1.0.0"))).json();
    expect(data.client).toMatchObject({ minimumVersion: null, updateRequired: false });
  });

  it("requires the client header", async () => {
    const response = await getConfig(get("/api/v1/config", null));
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("client_required");
  });

  it("says service_unavailable when the areas cannot be read", async () => {
    areasFail = true;
    const response = await getConfig(get("/api/v1/config"));
    expect(response.status).toBe(503);
    expect((await response.json()).error.code).toBe("service_unavailable");
  });
});
