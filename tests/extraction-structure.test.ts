import { describe, expect, it, vi } from "vitest";
import { structureImage, structureOcrText } from "@/lib/extraction/structure";
import type { StructuringClient } from "@/lib/extraction/structure";
import { emptyBasket, type StructuredBasket } from "@/lib/extraction/schema";
import type { OcrResult } from "@/lib/ocr/types";
import type { ImageValidationSuccess } from "@/lib/validation/image";

/**
 * The structuring layer, against a fake client. Nothing here calls the network.
 *
 * The property that matters most is the one the whole architecture exists for:
 * on the default route the model must receive TEXT and never an image. That is
 * asserted directly on what the client was called with, because a regression
 * there would silently undo the privacy posture without failing anything else.
 */

const OCR: OcrResult = {
  text: "Al Safadi Restaurant\n2 x Chicken Shawarma  AED 64.00\nTotal AED 104.00",
  confidence: 93,
  engine: "tesseract.js@7 lstm eng+ara v1",
  durationMs: 620,
};

const IMAGE: ImageValidationSuccess = {
  ok: true,
  mimeType: "image/png",
  extension: "png",
  bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
};

function fakeClient(payload: StructuredBasket | null, stopReason = "end_turn") {
  const parse = vi.fn().mockResolvedValue({ stop_reason: stopReason, parsed_output: payload });
  return { client: { parse } as unknown as StructuringClient, parse };
}

function basket(overrides: Partial<StructuredBasket> = {}): StructuredBasket {
  return { ...emptyBasket(), restaurant_name: "Al Safadi", ...overrides };
}

describe("structureOcrText", () => {
  it("sends text and never an image", async () => {
    const { client, parse } = fakeClient(basket());
    await structureOcrText(OCR, client);

    const request = parse.mock.calls[0][0];
    const content = request.messages[0].content;

    expect(typeof content).toBe("string");
    expect(JSON.stringify(request)).not.toContain("base64");
    expect(JSON.stringify(request)).not.toContain('"image"');
  });

  it("passes the OCR text through, fenced as data", async () => {
    const { client, parse } = fakeClient(basket());
    await structureOcrText(OCR, client);

    const content = parse.mock.calls[0][0].messages[0].content as string;
    expect(content).toContain("<ocr_text>");
    expect(content).toContain("Al Safadi Restaurant");
    expect(content).toContain("</ocr_text>");
  });

  it("records how the basket was produced, for the audit trail", async () => {
    const { client } = fakeClient(basket());
    const outcome = await structureOcrText(OCR, client);
    if (!outcome.ok) throw new Error("expected success");

    expect(outcome.run.method).toBe("ocr_llm");
    expect(outcome.run.ocrText).toBe(OCR.text);
    expect(outcome.run.ocrConfidence).toBe(93);
    expect(outcome.run.ocrEngine).toBe(OCR.engine);
    expect(outcome.run.ocrMs).toBe(620);
    expect(outcome.run.promptVersion).toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(outcome.run.llmMs).toBeGreaterThanOrEqual(0);
  });

  it("cleans the model's output on the way back", async () => {
    const { client } = fakeClient(
      basket({ items: [{ name: "Hummus", quantity: 999, modifiers: [], unit_price: "", line_total: "18" }] }),
    );
    const outcome = await structureOcrText(OCR, client);
    if (!outcome.ok) throw new Error("expected success");

    expect(outcome.run.basket.items[0]?.quantity).toBe(99);
    expect(outcome.run.basket.items[0]?.line_total).toBe("18.00");
  });

  it("refuses to structure empty OCR text rather than asking the model", async () => {
    const { client, parse } = fakeClient(basket());
    const outcome = await structureOcrText({ ...OCR, text: "   " }, client);

    expect(outcome).toMatchObject({ ok: false, reason: "unreadable" });
    expect(parse).not.toHaveBeenCalled();
  });

  it("refuses a read too poor to be worth structuring, and says to try vision", async () => {
    const { client, parse } = fakeClient(basket());
    const outcome = await structureOcrText({ ...OCR, confidence: 11 }, client);

    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error("expected failure");
    expect(outcome.reason).toBe("unreadable");
    expect(outcome.detail).toContain("vision");
    expect(parse).not.toHaveBeenCalled();
  });

  it("fails closed on a safety refusal", async () => {
    const { client } = fakeClient(basket(), "refusal");
    expect(await structureOcrText(OCR, client)).toMatchObject({ ok: false, reason: "failed" });
  });

  it("fails closed when the response did not match the schema", async () => {
    const { client } = fakeClient(null);
    expect(await structureOcrText(OCR, client)).toMatchObject({ ok: false, reason: "failed" });
  });

  it("fails closed when the call throws", async () => {
    const client = {
      parse: vi.fn().mockRejectedValue(new Error("timeout")),
    } as unknown as StructuringClient;

    const outcome = await structureOcrText(OCR, client);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) throw new Error("expected failure");
    expect(outcome.detail).toContain("timeout");
  });

  it("reports itself unconfigured with no API key and no injected client", async () => {
    expect(await structureOcrText(OCR)).toEqual({ ok: false, reason: "not_configured" });
  });
});

describe("structureImage", () => {
  it("sends the image - this is the fallback that does", async () => {
    const { client, parse } = fakeClient(basket());
    await structureImage(IMAGE, client);

    const content = parse.mock.calls[0][0].messages[0].content;
    expect(Array.isArray(content)).toBe(true);
    expect(content[0]).toMatchObject({ type: "image", source: { type: "base64" } });
  });

  it("marks the run as vision, with no OCR fields", async () => {
    const { client } = fakeClient(basket());
    const outcome = await structureImage(IMAGE, client);
    if (!outcome.ok) throw new Error("expected success");

    expect(outcome.run.method).toBe("vision");
    expect(outcome.run.ocrText).toBeNull();
    expect(outcome.run.ocrConfidence).toBeNull();
    expect(outcome.run.ocrEngine).toBeNull();
  });

  it("uses a different prompt from the OCR route", async () => {
    const ocrCall = fakeClient(basket());
    const visionCall = fakeClient(basket());

    await structureOcrText(OCR, ocrCall.client);
    await structureImage(IMAGE, visionCall.client);

    expect(ocrCall.parse.mock.calls[0][0].system).not.toBe(
      visionCall.parse.mock.calls[0][0].system,
    );
    expect(ocrCall.parse.mock.calls[0][0].system).toContain("OCR");
  });
});
