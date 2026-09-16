import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The one model call a stranger can trigger.
 *
 * Every other path to Claude in this codebase sits behind requireAdmin(). This
 * one is open to anybody who can reach the site, and it costs money per call, so
 * what is pinned here is the order of the guards - the cheap refusals have to
 * happen before the expensive work, or the rate limit is decoration.
 */

const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52,
  0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 0x1f, 0x15, 0xc4, 0x89,
]);

let configured = true;
let calls = 0;
let outcome: unknown = null;

vi.mock("@/lib/env", () => ({
  isExtractionConfigured: () => configured,
  getExtractionModel: () => "claude-haiku-4-5",
}));

vi.mock("@/lib/extraction/structure", () => ({
  structureImage: async () => {
    calls += 1;
    return outcome;
  },
}));

const { POST } = await import("@/app/api/extract/route");

function imageRequest(bytes: Uint8Array = PNG, name = "cart.png", type = "image/png") {
  const body = new FormData();
  body.append("image", new File([bytes as BlobPart], name, { type }));
  // A fresh address per request, so one test's budget is not another's.
  return new Request("https://example.test/api/extract", {
    method: "POST",
    body,
    headers: { "x-forwarded-for": `10.0.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}` },
  });
}

const OK_OUTCOME = {
  ok: true,
  run: {
    method: "vision",
    basket: { restaurant_name: "Chicking", items: [], final_total: "40.50" },
    model: "claude-opus-5",
    promptVersion: "v1",
    llmMs: 900,
    ocrText: null,
    ocrConfidence: null,
    ocrEngine: null,
    ocrMs: null,
  },
};

beforeEach(() => {
  configured = true;
  calls = 0;
  outcome = OK_OUTCOME;
});

describe("POST /api/extract", () => {
  it("returns the basket and nothing else about the run", async () => {
    const response = await POST(imageRequest());
    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(payload.basket.restaurant_name).toBe("Chicking");
    // The model, the prompt version and the timings are ours, not the
    // customer's - and none of it would survive their edits anyway.
    expect(payload).toEqual({ basket: payload.basket });
  });

  it("says 503 when no key is set, so the browser can read it instead", async () => {
    configured = false;
    const response = await POST(imageRequest());
    expect(response.status).toBe(503);
    // And it never reached the model.
    expect(calls).toBe(0);
  });

  it("rejects a file that is not the image it claims to be", async () => {
    const notAnImage = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]); // "%PDF-"
    const response = await POST(imageRequest(notAnImage, "cart.png", "image/png"));
    expect(response.status).toBe(400);
    expect(calls).toBe(0);
  });

  it("rejects a request with no image at all", async () => {
    const body = new FormData();
    body.append("image", "not a file");
    const response = await POST(
      new Request("https://example.test/api/extract", {
        method: "POST",
        body,
        headers: { "x-forwarded-for": "10.9.9.9" },
      }),
    );
    expect(response.status).toBe(400);
    expect(calls).toBe(0);
  });

  it("stops one address before the bill does", async () => {
    const from = (n: number) =>
      new Request("https://example.test/api/extract", {
        method: "POST",
        body: (() => {
          const b = new FormData();
          b.append("image", new File([PNG as BlobPart], "c.png", { type: "image/png" }));
          return b;
        })(),
        headers: { "x-forwarded-for": `172.16.0.${n}` },
      });

    const statuses: number[] = [];
    for (let i = 0; i < 15; i++) statuses.push((await POST(from(7))).status);

    expect(statuses.filter((s) => s === 429).length).toBeGreaterThan(0);
    // The limit is the point: refusals must not have cost anything.
    expect(calls).toBeLessThan(statuses.length);
  });

  it("tells the customer nothing about why the model failed", async () => {
    outcome = { ok: false, reason: "failed", detail: "invalid JSON from model" };
    const response = await POST(imageRequest());
    expect(response.status).toBe(502);
    expect(JSON.stringify(await response.json())).not.toContain("JSON");
  });

  it("logs the model and the reason, so a bad EXTRACTION_MODEL is findable", async () => {
    // The browser falls back, so a model refusing every request looks exactly
    // like one that works. This log line is the only place the difference shows.
    const logged: unknown[][] = [];
    const spy = vi.spyOn(console, "error").mockImplementation((...args) => {
      logged.push(args);
    });

    outcome = { ok: false, reason: "failed", detail: "model: unknown model" };
    await POST(imageRequest());
    spy.mockRestore();

    const line = JSON.stringify(logged);
    expect(line).toContain("claude-haiku-4-5");
    expect(line).toContain("unknown model");
  });

  it("keeps the customer out of the log", async () => {
    const logged: unknown[][] = [];
    const spy = vi.spyOn(console, "error").mockImplementation((...args) => {
      logged.push(args);
    });

    outcome = { ok: false, reason: "failed", detail: "boom" };
    await POST(imageRequest());
    spy.mockRestore();

    // No screenshot, no basket, no filename. A log is not the place for any of
    // it, and this one runs on every failed customer upload.
    const line = JSON.stringify(logged);
    expect(line).not.toContain("cart.png");
    expect(line).not.toContain("basket");
    expect(line).not.toContain("image");
  });
});
