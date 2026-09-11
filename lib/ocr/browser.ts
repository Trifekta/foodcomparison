"use client";

import {
  OCR_ASSET_PATHS,
  OCR_ENGINE_MODE,
  OCR_LANGUAGES_CUSTOMER,
  OCR_LANGUAGES_STAFF,
  OCR_PARAMETERS,
  ocrEngineVersion,
} from "./config";
import { enlargeForOcr } from "./preprocess";
import type { OcrOutcome } from "./types";

/**
 * Runs OCR in the admin's browser.
 *
 * This is the whole point of the hybrid design: the screenshot is already in
 * the admin's browser because they are looking at it, so reading it there costs
 * nothing in privacy terms. No server sees the image, and only the resulting
 * text is sent on to be structured.
 *
 * tesseract.js is imported lazily so that ~3 MB of WASM is fetched the first
 * time an admin presses the button, not on every page load.
 */

type TesseractWorker = {
  setParameters: (parameters: Record<string, string>) => Promise<unknown>;
  recognize: (image: Blob | string) => Promise<{ data: { text: string; confidence: number } }>;
  terminate: () => Promise<unknown>;
};

/** Customers load English only; staff load Arabic too. See config.ts. */
export type OcrAudience = "customer" | "staff";

function languagesFor(audience: OcrAudience): readonly string[] {
  return audience === "staff" ? OCR_LANGUAGES_STAFF : OCR_LANGUAGES_CUSTOMER;
}

let workerPromise: Promise<TesseractWorker> | null = null;
let workerAudience: OcrAudience | null = null;

/**
 * One worker per page, reused across runs.
 *
 * Starting a worker means fetching and compiling the WASM core and both
 * language files. Doing that per screenshot would make the second extraction
 * as slow as the first, which is the wrong shape for an admin working through
 * a queue of submissions.
 */
async function getWorker(
  audience: OcrAudience,
  onProgress?: (message: string) => void,
): Promise<TesseractWorker> {
  if (workerPromise && workerAudience === audience) return workerPromise;

  workerAudience = audience;
  workerPromise = (async () => {
    const { createWorker } = await import("tesseract.js");

    const worker = (await createWorker(
      [...languagesFor(audience)],
      OCR_ENGINE_MODE,
      {
        ...OCR_ASSET_PATHS,
        logger: (message: { status?: string; progress?: number }) => {
          if (!onProgress || !message.status) return;
          const percent = Math.round((message.progress ?? 0) * 100);
          onProgress(`${message.status} ${percent}%`);
        },
      },
    )) as unknown as TesseractWorker;

    await worker.setParameters(OCR_PARAMETERS);
    return worker;
  })();

  try {
    return await workerPromise;
  } catch (error) {
    // A failed start must not poison every later attempt.
    workerPromise = null;
    workerAudience = null;
    throw error;
  }
}

/**
 * Starts fetching and compiling the engine without reading anything yet.
 *
 * Called when the upload step appears, so the several megabytes come down while
 * the customer is picking a photo out of their gallery - time they were going
 * to spend anyway. Without this the download begins only once they have chosen,
 * and lands squarely in front of the screen we want to impress them with.
 */
export function warmOcr(audience: OcrAudience = "customer"): void {
  void getWorker(audience).catch(() => {
    // Warming is best-effort; a real read will surface any problem.
  });
}

export async function readImageInBrowser(
  image: Blob,
  onProgress?: (message: string) => void,
  audience: OcrAudience = "customer",
): Promise<OcrOutcome> {
  const startedAt = Date.now();

  try {
    const worker = await getWorker(audience, onProgress);
    // Enlarged first: a phone screenshot is below the resolution the engine
    // wants, and doubling it is the difference between reading a restaurant
    // name and reading "SMe". See preprocess.ts.
    const { data } = await worker.recognize(await enlargeForOcr(image));

    return {
      ok: true,
      text: data.text,
      confidence: data.confidence,
      engine: ocrEngineVersion(languagesFor(audience)),
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "The screenshot could not be read.",
    };
  }
}

/** Frees the WASM worker. Called when the admin navigates away. */
export async function releaseOcrWorker(): Promise<void> {
  if (!workerPromise) return;
  const pending = workerPromise;
  workerPromise = null;
  workerAudience = null;
  try {
    const worker = await pending;
    await worker.terminate();
  } catch {
    // Nothing useful to do: the page is going away.
  }
}
