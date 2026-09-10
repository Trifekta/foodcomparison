import { describe, expect, it, vi } from "vitest";
import { extractBasket, type ExtractionClient } from "@/lib/extraction/extract";
import type { ImageValidationSuccess } from "@/lib/validation/image";

/**
 * The screenshot reader, exercised against a fake client.
 *
 * No test here makes a live call. What matters is not that the model is clever
 * but that nothing it returns can reach the database unchecked: prices,
 * quantities and names all get the same treatment a typed basket would, and
 * every failure mode degrades to "the customer types it themselves".
 */

const IMAGE: ImageValidationSuccess = {
  ok: true,
  mimeType: "image/png",
  extension: "png",
  bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
};

type ModelPayload = {
  restaurantName: string;
  items: Array<{ name: string; quantity: number; linePrice: string }>;
  orderTotal: string;
  readable: boolean;
};

/** A client that returns whatever the test dictates, without touching a network. */
function fakeClient(
  payload: ModelPayload | null,
  stopReason: string = "end_turn",
): ExtractionClient {
  return {
    parse: vi.fn().mockResolvedValue({
      stop_reason: stopReason,
      parsed_output: payload,
    }),
  } as unknown as ExtractionClient;
}

function payload(overrides: Partial<ModelPayload> = {}): ModelPayload {
  return {
    restaurantName: "Al Safadi",
    items: [{ name: "Chicken Shawarma", quantity: 2, linePrice: "64.00" }],
    orderTotal: "82.00",
    readable: true,
    ...overrides,
  };
}

async function run(client: ExtractionClient) {
  const outcome = await extractBasket(IMAGE, client);
  if (!outcome.ok) throw new Error(`expected a result, got ${outcome.reason}`);
  return outcome.result;
}

describe("extractBasket", () => {
  it("returns what the screenshot showed", async () => {
    const result = await run(fakeClient(payload()));

    expect(result.restaurantName).toBe("Al Safadi");
    expect(result.orderTotalMinor).toBe(8200);
    expect(result.items).toEqual([
      { name: "Chicken Shawarma", quantity: 2, linePriceMinor: 6400 },
    ]);
  });

  it("keeps prices in integer fils, never floats", async () => {
    const result = await run(
      fakeClient(payload({ items: [{ name: "Juice", quantity: 1, linePrice: "8.5" }] })),
    );
    expect(result.items[0]?.linePriceMinor).toBe(850);
  });

  it("keeps an item whose price was not shown", async () => {
    const result = await run(
      fakeClient(payload({ items: [{ name: "Bread", quantity: 1, linePrice: "" }] })),
    );
    expect(result.items).toEqual([{ name: "Bread", quantity: 1, linePriceMinor: null }]);
  });

  it("drops a price it could not have read, keeping the item", async () => {
    // A misplaced decimal point turns 85.00 into 8500.00 - past anything a
    // Dubai food order costs, so the price goes and the item stays.
    const result = await run(
      fakeClient(payload({ items: [{ name: "Mixed Grill", quantity: 1, linePrice: "850000" }] })),
    );
    expect(result.items).toEqual([{ name: "Mixed Grill", quantity: 1, linePriceMinor: null }]);
  });

  it("drops a nonsense price string without losing the item", async () => {
    const result = await run(
      fakeClient(payload({ items: [{ name: "Salad", quantity: 1, linePrice: "AED 20-ish" }] })),
    );
    expect(result.items[0]).toEqual({ name: "Salad", quantity: 1, linePriceMinor: null });
  });

  it("clamps a quantity outside what the database would accept", async () => {
    const result = await run(
      fakeClient(
        payload({
          items: [
            { name: "A", quantity: 0, linePrice: "" },
            { name: "B", quantity: 5000, linePrice: "" },
          ],
        }),
      ),
    );
    expect(result.items.map((item) => item.quantity)).toEqual([1, 99]);
  });

  it("caps the list so one bad read cannot flood the basket", async () => {
    const many = Array.from({ length: 40 }, (_, index) => ({
      name: `Item ${index}`,
      quantity: 1,
      linePrice: "",
    }));
    const result = await run(fakeClient(payload({ items: many })));
    expect(result.items).toHaveLength(20);
  });

  it("drops rows with no usable name", async () => {
    const result = await run(
      fakeClient(
        payload({
          items: [
            { name: "   ", quantity: 1, linePrice: "10.00" },
            { name: "Hummus", quantity: 1, linePrice: "12.00" },
          ],
        }),
      ),
    );
    expect(result.items.map((item) => item.name)).toEqual(["Hummus"]);
  });

  it("strips control characters out of a name", async () => {
    const smuggled = `Hum${String.fromCharCode(0)}mus`;
    const result = await run(
      fakeClient(payload({ items: [{ name: smuggled, quantity: 1, linePrice: "" }] })),
    );
    expect(result.items[0]?.name).toBe("Hummus");
  });

  it("reports an unreadable image as empty rather than guessing", async () => {
    const result = await run(
      fakeClient({ restaurantName: "", items: [], orderTotal: "", readable: false }),
    );
    expect(result).toEqual({
      restaurantName: null,
      items: [],
      orderTotalMinor: null,
      readable: false,
    });
  });

  it("treats a missing restaurant name as absent, not as an empty string", async () => {
    const result = await run(fakeClient(payload({ restaurantName: "" })));
    expect(result.restaurantName).toBeNull();
  });

  it("fails closed when the response did not parse", async () => {
    const outcome = await extractBasket(IMAGE, fakeClient(null));
    expect(outcome).toEqual({ ok: false, reason: "failed" });
  });

  it("fails closed on a safety refusal", async () => {
    const outcome = await extractBasket(IMAGE, fakeClient(payload(), "refusal"));
    expect(outcome).toEqual({ ok: false, reason: "failed" });
  });

  it("fails closed when the call throws", async () => {
    const client = {
      parse: vi.fn().mockRejectedValue(new Error("timeout")),
    } as unknown as ExtractionClient;

    const outcome = await extractBasket(IMAGE, client);
    expect(outcome).toEqual({ ok: false, reason: "failed" });
  });

  it("reports itself unconfigured when there is no API key", async () => {
    const outcome = await extractBasket(IMAGE);
    expect(outcome).toEqual({ ok: false, reason: "not_configured" });
  });
});
