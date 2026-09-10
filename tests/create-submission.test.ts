import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The public submission path, exercised against a fake Supabase client.
 *
 * This is the only route customer data takes into the database, so the parts
 * worth pinning here are the ones a browser can lie about: the restaurant name
 * and the optional item list, which arrives as one JSON entry.
 */

interface Insert {
  table: string;
  rows: unknown;
}

const AREA_ID = "3f7d6d1a-6d8b-4c2f-9d51-3c9e2b7f1a55";

const inserts: Insert[] = [];
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
                  Promise.resolve({ data: { id: AREA_ID, active: areaActive }, error: null }),
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

const { createSubmission } = await import("@/lib/submissions/create");

/** Smallest byte sequence that passes the server's magic-byte check. */
function pngFile(): File {
  const bytes = new Uint8Array(32);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return new File([bytes], "cart.png", { type: "image/png" });
}

function formData(overrides: Record<string, string> = {}): FormData {
  const body = new FormData();
  body.append("cartImage", pngFile());
  const fields: Record<string, string> = {
    restaurantName: "Al Safadi",
    areaId: AREA_ID,
    sourceApp: "Talabat",
    sourceAppOther: "",
    currentTotal: "82.00",
    contactType: "whatsapp",
    dialCode: "+971",
    whatsappNumber: "501234567",
    email: "",
    marketingConsent: "false",
    ...overrides,
  };
  for (const [key, value] of Object.entries(fields)) body.append(key, value);
  return body;
}

function submissionRow(): Record<string, unknown> {
  const entry = inserts.find((row) => row.table === "submissions");
  return (entry?.rows ?? {}) as Record<string, unknown>;
}

function itemRows(): Array<Record<string, unknown>> {
  const entry = inserts.find((row) => row.table === "submission_items");
  return (entry?.rows ?? []) as Array<Record<string, unknown>>;
}

beforeEach(() => {
  inserts.length = 0;
  areaActive = true;
});

describe("createSubmission", () => {
  it("stores the restaurant the customer named", async () => {
    const result = await createSubmission(formData({ restaurantName: "  Al Safadi  " }));
    expect(result.ok).toBe(true);
    expect(submissionRow().restaurant_name).toBe("Al Safadi");
  });

  it("refuses a submission with no restaurant", async () => {
    const result = await createSubmission(formData({ restaurantName: "" }));
    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.field).toBe("restaurantName");
    expect(inserts).toHaveLength(0);
  });

  it("stores items in the order they were listed", async () => {
    const body = formData();
    body.append(
      "items",
      JSON.stringify([
        { name: "Chicken Shawarma", quantity: 2 },
        { name: "Hummus", quantity: 1 },
      ]),
    );

    const result = await createSubmission(body);
    expect(result.ok).toBe(true);
    expect(itemRows()).toEqual([
      expect.objectContaining({ name: "Chicken Shawarma", quantity: 2, sort_order: 0 }),
      expect.objectContaining({ name: "Hummus", quantity: 1, sort_order: 1 }),
    ]);
  });

  it("accepts a submission with no items at all", async () => {
    const result = await createSubmission(formData());
    expect(result.ok).toBe(true);
    expect(inserts.some((row) => row.table === "submission_items")).toBe(false);
  });

  it("records how many items were stored on the created event", async () => {
    const body = formData();
    body.append("items", JSON.stringify([{ name: "Hummus", quantity: 1 }]));
    await createSubmission(body);

    const event = inserts.find((row) => row.table === "submission_events")?.rows as {
      metadata: { item_count: number };
    };
    expect(event.metadata.item_count).toBe(1);
  });

  it("rejects malformed item JSON rather than silently dropping the basket", async () => {
    const body = formData();
    body.append("items", "not json");
    const result = await createSubmission(body);
    expect(result.ok).toBe(false);
    expect(result.ok ? null : result.field).toBe("items");
    expect(inserts).toHaveLength(0);
  });

  it("rejects a quantity the database constraint would refuse", async () => {
    const body = formData();
    body.append("items", JSON.stringify([{ name: "Hummus", quantity: 0 }]));
    const result = await createSubmission(body);
    expect(result.ok).toBe(false);
    expect(inserts).toHaveLength(0);
  });

  it("rejects more items than the cap allows", async () => {
    const body = formData();
    body.append(
      "items",
      JSON.stringify(Array.from({ length: 21 }, () => ({ name: "Item", quantity: 1 }))),
    );
    const result = await createSubmission(body);
    expect(result.ok).toBe(false);
    expect(inserts).toHaveLength(0);
  });

  it("strips control characters out of item names before storing them", async () => {
    const body = formData();
    const smuggled = `Hum${String.fromCharCode(0)}mus`;
    body.append("items", JSON.stringify([{ name: smuggled, quantity: 1 }]));

    const result = await createSubmission(body);
    expect(result.ok).toBe(true);
    expect(itemRows()[0]?.name).toBe("Hummus");
  });
});
