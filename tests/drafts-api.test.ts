import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { startFakeSupabase, type FakeSupabase } from "./support/fake-supabase";
import { hashDraftToken } from "@/lib/drafts/token";

/**
 * The draft API, run for real against a fake Supabase.
 *
 * What is pinned here is ownership: a token opens exactly one draft and
 * exactly that draft's two files, whatever else a request says; the browser
 * never gets to name a path; the database never holds a usable token; and
 * none of it can reach, or break, the submission path.
 */

vi.mock("@/lib/notifications/admin-alert", () => ({ alertAdminOfNewSubmission: async () => {} }));

let fake: FakeSupabase;
let drafts: typeof import("@/app/api/drafts/route");
let images: typeof import("@/app/api/drafts/image/route");
let submissions: typeof import("@/app/api/submissions/route");
let prune: typeof import("@/app/api/cron/prune-drafts/route");
let resetRateLimits: () => void;

const BUCKET = "submission-images";
const AREA_ID = "3f7d6d1a-6d8b-4c2f-9d51-3c9e2b7f1a55";
const BASE = "https://snipsavor.test";

function png(marker: number): Uint8Array {
  const bytes = new Uint8Array(64);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  bytes[40] = marker;
  return bytes;
}

function progress(overrides: Record<string, unknown> = {}) {
  return {
    step: 1,
    values: {
      restaurantName: "Al Safadi",
      areaId: AREA_ID,
      currentTotal: "82.00",
      newToKeeta: "no",
      dialCode: "+971",
      marketingConsent: false,
    },
    items: [],
    autofilled: null,
    reads: { cart: null, checkout: null },
    ...overrides,
  };
}

interface Call {
  method?: string;
  token?: string;
  cookie?: string;
  json?: unknown;
  form?: FormData;
}

function request(path: string, { method = "GET", token, cookie, json, form }: Call = {}) {
  const headers = new Headers({ "x-forwarded-for": "10.0.0.1" });
  if (token !== undefined) headers.set("x-draft-token", token);
  if (cookie) headers.set("cookie", `snipsavor_draft=${cookie}`);
  let body: BodyInit | undefined;
  if (json !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(json);
  }
  if (form) body = form;
  return new Request(`${BASE}${path}`, { method, headers, body });
}

async function create(overrides: Record<string, unknown> = {}): Promise<string> {
  const response = await drafts.POST(request("/api/drafts", { method: "POST", json: progress(overrides) }));
  expect(response.status).toBe(201);
  return ((await response.json()) as { token: string }).token;
}

async function upload(token: string, slot: string, bytes: Uint8Array) {
  const form = new FormData();
  form.append("image", new File([bytes as BlobPart], "shot.png", { type: "image/png" }));
  return images.PUT(request(`/api/drafts/image?slot=${slot}`, { method: "PUT", token, form }));
}

function draftRows() {
  return fake.tables.get("wizard_drafts") ?? [];
}

async function rowFor(token: string) {
  const hash = await hashDraftToken(token);
  return draftRows().find((row) => row.token_hash === hash);
}

beforeAll(async () => {
  fake = await startFakeSupabase();
  process.env.NEXT_PUBLIC_SUPABASE_URL = fake.url;
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service";
  process.env.CRON_SECRET = "cron-secret";

  drafts = await import("@/app/api/drafts/route");
  images = await import("@/app/api/drafts/image/route");
  submissions = await import("@/app/api/submissions/route");
  prune = await import("@/app/api/cron/prune-drafts/route");
  ({ resetRateLimits } = await import("@/lib/utils/rate-limit"));
});

afterAll(async () => {
  await fake.close();
});

beforeEach(() => {
  fake.reset();
  resetRateLimits();
  process.env.DRAFT_RESUME = "on";
  fake.tables.set("areas", [{ id: AREA_ID, active: true, name: "Al Barsha" }]);
});

describe("the feature flag", () => {
  it("answers 404 everywhere and writes nothing while off", async () => {
    process.env.DRAFT_RESUME = "off";

    const created = await drafts.POST(request("/api/drafts", { method: "POST", json: progress() }));
    expect(created.status).toBe(404);
    expect((await drafts.GET(request("/api/drafts", { token: "x".repeat(43) }))).status).toBe(404);
    expect((await upload("x".repeat(43), "cart", png(1))).status).toBe(404);
    expect(draftRows()).toHaveLength(0);
    expect(fake.objects.size).toBe(0);
  });

  it("treats anything unrecognised as off", async () => {
    process.env.DRAFT_RESUME = "yes please";
    const created = await drafts.POST(request("/api/drafts", { method: "POST", json: progress() }));
    expect(created.status).toBe(404);
  });
});

describe("the token", () => {
  it("is high-entropy, and only its hash is stored", async () => {
    const token = await create();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const row = await rowFor(token);
    expect(row).toBeDefined();
    expect(JSON.stringify(draftRows())).not.toContain(token);
  });

  it("is also set as an HttpOnly cookie scoped to the API", async () => {
    const response = await drafts.POST(request("/api/drafts", { method: "POST", json: progress() }));
    const cookies = response.headers.getSetCookie();
    const secret = cookies.find((cookie) => cookie.startsWith("snipsavor_draft="));
    expect(secret).toMatch(/HttpOnly/i);
    expect(secret).toMatch(/Path=\/api(;|$)/);
    expect(secret).toMatch(/SameSite=lax/i);
    expect(secret).toMatch(/Secure/i);
    // The readable hint says a draft may exist and nothing else.
    expect(cookies.find((cookie) => cookie.startsWith("snipsavor_draft_hint="))).toMatch(/^snipsavor_draft_hint=1;/);
  });

  it("opens nothing when unknown, malformed or expired", async () => {
    const token = await create();

    expect((await drafts.GET(request("/api/drafts", { token: "A".repeat(43) }))).status).toBe(404);
    expect((await drafts.GET(request("/api/drafts", { token: "short" }))).status).toBe(404);
    expect((await drafts.GET(request("/api/drafts"))).status).toBe(404);

    (await rowFor(token))!.expires_at = new Date(Date.now() - 1000).toISOString();
    expect((await drafts.GET(request("/api/drafts", { token }))).status).toBe(404);
  });

  it("works from the cookie alone, and a header beats the cookie", async () => {
    const a = await create({ values: { ...progress().values, restaurantName: "Alpha" } });
    const b = await create({ values: { ...progress().values, restaurantName: "Bravo" } });

    const byCookie = await drafts.GET(request("/api/drafts", { cookie: a }));
    expect(((await byCookie.json()) as { progress: { values: { restaurantName: string } } }).progress.values.restaurantName).toBe("Alpha");

    const both = await drafts.GET(request("/api/drafts", { token: b, cookie: a }));
    expect(((await both.json()) as { progress: { values: { restaurantName: string } } }).progress.values.restaurantName).toBe("Bravo");
  });
});

describe("what a draft stores", () => {
  it("never keeps a WhatsApp number, even when one is sent", async () => {
    const sneaky = progress();
    (sneaky.values as Record<string, unknown>).whatsappNumber = "501234567";
    (sneaky as Record<string, unknown>).whatsappNumber = "501234567";

    const token = await create(sneaky);
    await drafts.PUT(request("/api/drafts", { method: "PUT", token, json: sneaky }));

    expect(JSON.stringify(draftRows())).not.toContain("501234567");
  });

  it("keeps step, items, totals and reads across a save", async () => {
    const token = await create();
    const later = progress({
      step: 2,
      items: [{ key: "k1", name: "Shawarma", quantity: 2, linePrice: "24.00", proposed: null }],
      autofilled: "82.00",
      reads: {
        cart: {
          status: "applied",
          totals: { subtotal: "70.00", deliveryFee: "7.00", serviceFee: "5.00", discount: "", finalTotal: "82.00" },
        },
        checkout: null,
      },
    });

    expect((await drafts.PUT(request("/api/drafts", { method: "PUT", token, json: later }))).status).toBe(204);
    const read = (await (await drafts.GET(request("/api/drafts", { token }))).json()) as {
      progress: typeof later;
    };
    expect(read.progress).toEqual(later);
  });

  it("refuses oversized or malformed progress", async () => {
    const token = await create();
    const huge = progress({ items: Array.from({ length: 61 }, (_, i) => ({ key: `k${i}`, name: "x", quantity: 1, linePrice: null, proposed: null })) });
    expect((await drafts.PUT(request("/api/drafts", { method: "PUT", token, json: huge }))).status).toBe(400);
    expect((await drafts.PUT(request("/api/drafts", { method: "PUT", token, json: { step: 7 } }))).status).toBe(400);
  });
});

describe("draft images belong to their draft", () => {
  it("derives every path from the draft's own row", async () => {
    const token = await create();
    expect((await upload(token, "cart", png(1))).status).toBe(204);

    const row = await rowFor(token);
    expect(row!.cart_image_path).toBe(`drafts/${row!.id}/cart.png`);
    expect(fake.objects.has(`${BUCKET}/drafts/${row!.id}/cart.png`)).toBe(true);
  });

  it("never lets one draft read another draft's screenshot", async () => {
    const a = await create();
    const b = await create();
    await upload(a, "cart", png(0xaa));

    const aRow = await rowFor(a);
    const stolen = await images.GET(
      request(`/api/drafts/image?slot=cart&path=drafts/${aRow!.id}/cart.png&id=${aRow!.id}`, { token: b }),
    );
    expect(stolen.status).toBe(404);

    const own = await images.GET(request("/api/drafts/image?slot=cart", { token: a }));
    expect(own.status).toBe(200);
    expect(new Uint8Array(await own.arrayBuffer())[40]).toBe(0xaa);
  });

  it("never lets one draft overwrite or delete another draft's screenshot", async () => {
    const a = await create();
    const b = await create();
    await upload(a, "cart", png(0xaa));
    const aRow = await rowFor(a);
    const aKey = `${BUCKET}/drafts/${aRow!.id}/cart.png`;

    await upload(b, "cart", png(0xbb));
    await images.DELETE(request("/api/drafts/image?slot=cart", { method: "DELETE", token: b }));
    await drafts.DELETE(request("/api/drafts", { method: "DELETE", token: b }));

    expect(fake.objects.get(aKey)?.bytes[40]).toBe(0xaa);
    expect(aRow!.cart_image_path).toBe(`drafts/${aRow!.id}/cart.png`);
  });

  it("accepts only the two slot names", async () => {
    const token = await create();
    for (const slot of ["../submissions/x/cart", "submissions", "cart.png", "", "CART"]) {
      const response = await images.GET(request(`/api/drafts/image?slot=${encodeURIComponent(slot)}`, { token }));
      expect(response.status).toBe(400);
    }
  });

  it("stores only real images, and checks them again on the way out", async () => {
    const token = await create();
    const form = new FormData();
    form.append("image", new File(["<script>alert(1)</script>"], "x.png", { type: "image/png" }));
    const rejected = await images.PUT(request("/api/drafts/image?slot=cart", { method: "PUT", token, form }));
    expect(rejected.status).toBe(400);

    await upload(token, "cart", png(1));
    const row = await rowFor(token);
    fake.objects.get(`${BUCKET}/${row!.cart_image_path}`)!.bytes = new TextEncoder().encode("<html>not an image</html>");
    expect((await images.GET(request("/api/drafts/image?slot=cart", { token }))).status).toBe(404);
  });

  it("is refused by the database when a path names another draft", async () => {
    // Mirrors the check constraints in 0027_wizard_drafts.sql, which the fake
    // enforces: even a bug that built the wrong path could not store it.
    const a = await create();
    const b = await create();
    const aRow = await rowFor(a);
    const bRow = await rowFor(b);

    const client = (await import("@/lib/supabase/admin")).createAdminClient();
    const { error } = await client
      .from("wizard_drafts")
      .update({ cart_image_path: `drafts/${aRow!.id}/cart.png` })
      .eq("id", bRow!.id);
    expect(error?.message).toMatch(/cart_path_owned/);
  });
});

describe("the submission path", () => {
  function submission(extra: Record<string, string> = {}) {
    const body = new FormData();
    body.append("cartImage", new File([png(7) as BlobPart], "cart.png", { type: "image/png" }));
    const fields: Record<string, string> = {
      restaurantName: "Al Safadi",
      areaId: AREA_ID,
      currentTotal: "82.00",
      newToKeeta: "no",
      dialCode: "+971",
      whatsappNumber: "501234567",
      marketingConsent: "false",
      ...extra,
    };
    for (const [key, value] of Object.entries(fields)) body.append(key, value);
    return new Request(`${BASE}/api/submissions`, {
      method: "POST",
      headers: { "x-forwarded-for": `10.9.${Math.floor(Math.random() * 250)}.1` },
      body,
    });
  }

  it("throws the draft and its files away once the order is in", async () => {
    const token = await create();
    await upload(token, "cart", png(1));
    await upload(token, "checkout", png(2));

    const response = await submissions.POST(submission({ draftToken: token }));
    expect(response.status).toBe(201);

    expect(draftRows()).toHaveLength(0);
    expect([...fake.objects.keys()].some((key) => key.includes("/drafts/"))).toBe(false);
    expect(response.headers.getSetCookie().find((c) => c.startsWith("snipsavor_draft="))).toMatch(/Max-Age=0/);
  });

  it("stores the screenshot it was sent, never a draft path", async () => {
    const token = await create();
    await upload(token, "cart", png(1));
    const row = await rowFor(token);

    const response = await submissions.POST(
      submission({ draftToken: token, cartImagePath: row!.cart_image_path as string }),
    );
    expect(response.status).toBe(201);

    const stored = (fake.tables.get("submissions") ?? [])[0];
    expect(String(stored.cart_image_path)).toMatch(/^submissions\//);
    expect(fake.objects.get(`${BUCKET}/${stored.cart_image_path}`)?.bytes[40]).toBe(7);
  });

  it("is untouched with the flag off: draftToken is ignored and the draft kept", async () => {
    const token = await create();
    process.env.DRAFT_RESUME = "off";

    const response = await submissions.POST(submission({ draftToken: token }));
    expect(response.status).toBe(201);
    expect(draftRows()).toHaveLength(1);
    expect(response.headers.getSetCookie()).toHaveLength(0);
  });

  it("still succeeds with a bogus token, or when the draft table does not exist", async () => {
    expect((await submissions.POST(submission({ draftToken: "not-a-token" }))).status).toBe(201);

    fake.missingTables.add("wizard_drafts");
    expect((await submissions.POST(submission({ draftToken: "B".repeat(43) }))).status).toBe(201);
  });
});

describe("before the migration has run", () => {
  it("answers 503 from the draft API rather than failing loudly", async () => {
    fake.missingTables.add("wizard_drafts");
    const response = await drafts.POST(request("/api/drafts", { method: "POST", json: progress() }));
    expect(response.status).toBe(503);
  });
});

describe("cleanup", () => {
  function cron() {
    return new Request(`${BASE}/api/cron/prune-drafts`, {
      method: "POST",
      headers: { "x-cron-secret": "cron-secret" },
    });
  }

  it("refuses callers without the secret", async () => {
    const response = await prune.POST(new Request(`${BASE}/api/cron/prune-drafts`, { method: "POST" }));
    expect(response.status).toBe(404);
  });

  it("removes expired drafts and their files, and keeps live ones", async () => {
    const stale = await create();
    const live = await create();
    await upload(stale, "cart", png(1));
    await upload(live, "cart", png(2));
    const staleRow = await rowFor(stale);
    const liveRow = await rowFor(live);
    staleRow!.expires_at = new Date(Date.now() - 60_000).toISOString();

    const response = await prune.POST(cron());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ expiredDrafts: 1 });

    expect(draftRows().map((row) => row.id)).toEqual([liveRow!.id]);
    expect(fake.objects.has(`${BUCKET}/drafts/${staleRow!.id}/cart.png`)).toBe(false);
    expect(fake.objects.has(`${BUCKET}/drafts/${liveRow!.id}/cart.png`)).toBe(true);
  });

  it("removes files left behind by a draft that is already gone", async () => {
    const orphanId = "0b7b2a3e-9a3e-4f63-8a2f-6d7f6c1b2a11";
    fake.objects.set(`${BUCKET}/drafts/${orphanId}/cart.jpg`, { bytes: png(1), contentType: "image/png" });
    fake.objects.set(`${BUCKET}/submissions/keep-me/cart.jpg`, { bytes: png(1), contentType: "image/png" });

    const response = await prune.POST(cron());
    expect(await response.json()).toMatchObject({ orphanFolders: 1, filesRemoved: 1 });
    expect(fake.objects.has(`${BUCKET}/drafts/${orphanId}/cart.jpg`)).toBe(false);
    expect(fake.objects.has(`${BUCKET}/submissions/keep-me/cart.jpg`)).toBe(true);
  });

  it("does nothing, quietly, before the migration has run", async () => {
    fake.missingTables.add("wizard_drafts");
    const response = await prune.POST(cron());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ skipped: "table missing" });
  });
});
