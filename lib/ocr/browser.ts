"use client";

import {
  OCR_ASSET_PATHS,
  OCR_ENGINE_MODE,
  OCR_ENGINE_VERSION,
  OCR_LANGUAGES,
  OCR_PARAMETERS,
} from "./config";
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

let workerPromise: Promise<TesseractWorker> | null = null;

/**
 * One worker per page, reused across runs.
 *
 * Starting a worker means fetching and compiling the WASM core and both
 * language files. Doing that per screenshot would make the second extraction
 * as slow as the first, which is the wrong shape for an admin working through
 * a queue of submissions.
 */
async function getWorker(onProgress?: (message: string) => void): Promise<TesseractWorker> {
  if (workerPromise) return workerPromise;

  workerPromise = (async () => {
    const { createWorker } = await import("tesseract.js");

    const worker = (await createWorker(
      [...OCR_LANGUAGES],
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
    throw error;
  }
}

export async function readImageInBrowser(
  image: Blob,
  onProgress?: (message: string) => void,
): Promise<OcrOutcome> {
  const startedAt = Date.now();

  try {
    const worker = await getWorker(onProgress);
    const { data } = await worker.recognize(image);

    return {
      ok: true,
      text: data.text,
      confidence: data.confidence,
      engine: OCR_ENGINE_VERSION,
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
  try {
    const worker = await pending;
    await worker.terminate();
  } catch {
    // Nothing useful to do: the page is going away.
  }
}
