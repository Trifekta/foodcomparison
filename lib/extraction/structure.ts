import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { EXTRACTION_TIMEOUT_MS } from "@/lib/constants";
import { getAnthropicApiKey, getExtractionModel } from "@/lib/env";
import { OCR_MAX_TEXT_LENGTH, OCR_MIN_CONFIDENCE } from "@/lib/ocr/config";
import type { OcrResult } from "@/lib/ocr/types";
import type { ImageValidationSuccess } from "@/lib/validation/image";
import {
  OCR_SYSTEM_PROMPT,
  OCR_USER_PROMPT,
  PROMPT_VERSION,
  VISION_SYSTEM_PROMPT,
  VISION_USER_PROMPT,
} from "./prompt";
import { normaliseBasket } from "./normalise";
import { structuredBasketSchema, type ExtractionOutcome } from "./schema";

/**
 * Turns an order into structured data with Claude.
 *
 * Two entry points, and the difference between them is the whole point of this
 * design:
 *
 *   structureOcrText - the default. Claude receives TEXT ONLY. The screenshot
 *   never leaves our infrastructure; it was read in the admin's browser.
 *
 *   structureImage - the fallback, and only ever on an explicit admin action.
 *   This does send the image. It exists because Arabic OCR and low-contrast
 *   screenshots defeat Tesseract often enough to need an escape hatch, not
 *   because it is the normal route.
 *
 * Neither is authoritative. Both feed a review screen the admin must confirm.
 */

export interface StructuringClient {
  parse: Anthropic["messages"]["parse"];
}

function createClient(apiKey: string): StructuringClient {
  return new Anthropic({ apiKey, timeout: EXTRACTION_TIMEOUT_MS, maxRetries: 1 }).messages;
}

interface CallOptions {
  system: string;
  content: Anthropic.MessageParam["content"];
  client?: StructuringClient;
}

async function callModel({ system, content, client }: CallOptions) {
  const apiKey = getAnthropicApiKey();
  if (!client && !apiKey) return { kind: "not_configured" as const };

  const messages = client ?? createClient(apiKey as string);
  const model = getExtractionModel();
  const startedAt = Date.now();

  try {
    const response = await messages.parse({
      model,
      max_tokens: 8192,
      system,
      // Reading a receipt is not a reasoning problem, and an admin is waiting.
      // Thinking stays on: turning it off on this model family costs more in
      // reliability than the low effort setting saves in latency.
      output_config: { effort: "low", format: zodOutputFormat(structuredBasketSchema) },
      messages: [{ role: "user", content }],
    });

    if (response.stop_reason === "refusal") return { kind: "failed" as const, detail: "declined" };
    if (!response.parsed_output) {
      return { kind: "failed" as const, detail: "the response did not match the schema" };
    }

    return {
      kind: "ok" as const,
      basket: normaliseBasket(response.parsed_output),
      model,
      llmMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      kind: "failed" as const,
      detail: error instanceof Error ? error.message : "the request failed",
    };
  }
}

/** The default route. Text in, structure out. The image stays with us. */
export async function structureOcrText(
  ocr: OcrResult,
  client?: StructuringClient,
): Promise<ExtractionOutcome> {
  const text = ocr.text.trim();

  if (text.length === 0) {
    return { ok: false, reason: "unreadable", detail: "OCR returned no text." };
  }

  if (ocr.confidence < OCR_MIN_CONFIDENCE) {
    return {
      ok: false,
      reason: "unreadable",
      detail: `OCR confidence was ${ocr.confidence.toFixed(0)}%, too low to structure. Try the vision fallback.`,
    };
  }

  const result = await callModel({
    system: OCR_SYSTEM_PROMPT,
    // Fenced so a screenshot containing something that reads like an
    // instruction is presented as data to be structured, not as direction.
    content: `${OCR_USER_PROMPT}\n\n<ocr_text>\n${text.slice(0, OCR_MAX_TEXT_LENGTH)}\n</ocr_text>`,
    client,
  });

  if (result.kind === "not_configured") return { ok: false, reason: "not_configured" };
  if (result.kind === "failed") return { ok: false, reason: "failed", detail: result.detail };

  return {
    ok: true,
    run: {
      method: "ocr_llm",
      basket: result.basket,
      ocrText: ocr.text,
      ocrConfidence: ocr.confidence,
      ocrEngine: ocr.engine,
      ocrMs: ocr.durationMs,
      model: result.model,
      promptVersion: PROMPT_VERSION,
      llmMs: result.llmMs,
    },
  };
}

/** Base64 without blowing the stack on a multi-megabyte screenshot. */
function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

/**
 * The fallback. Sends the screenshot itself.
 *
 * Only ever reached from an explicit admin action - never from the customer
 * path, never automatically after a poor OCR read. The caller is responsible
 * for having asked.
 */
export async function structureImage(
  image: ImageValidationSuccess,
  client?: StructuringClient,
): Promise<ExtractionOutcome> {
  const result = await callModel({
    system: VISION_SYSTEM_PROMPT,
    content: [
      {
        type: "image",
        source: { type: "base64", media_type: image.mimeType, data: toBase64(image.bytes) },
      },
      { type: "text", text: VISION_USER_PROMPT },
    ],
    client,
  });

  if (result.kind === "not_configured") return { ok: false, reason: "not_configured" };
  if (result.kind === "failed") return { ok: false, reason: "failed", detail: result.detail };

  return {
    ok: true,
    run: {
      method: "vision",
      basket: result.basket,
      ocrText: null,
      ocrConfidence: null,
      ocrEngine: null,
      ocrMs: null,
      model: result.model,
      promptVersion: PROMPT_VERSION,
      llmMs: result.llmMs,
    },
  };
}
