/**
 * OCR settings, shared by every place that runs it.
 *
 * The browser (admin dashboard) and Node (the evaluation script) both read
 * from here so that what you measure offline is what the admin actually gets.
 * Divergence between the two would make the accuracy numbers meaningless.
 */

/** English and Arabic together: Dubai menus routinely mix both on one row. */
export const OCR_LANGUAGES = ["eng", "ara"] as const;

/**
 * LSTM only. The legacy engine is faster but markedly worse on the small,
 * anti-aliased text in a phone screenshot, and worse again on Arabic.
 */
export const OCR_ENGINE_MODE = 1;

/**
 * Recorded against every extraction so a change in reading behaviour is
 * traceable. Bump it whenever anything in this file changes.
 */
export const OCR_ENGINE_VERSION = "tesseract.js@7 lstm eng+ara v1";

export const OCR_PARAMETERS: Record<string, string> = {
  // Keeps the run of spaces between an item and its price, which is most of
  // what tells the structuring model which price belongs to which row.
  preserve_interword_spaces: "1",
};

/** Served from our own origin - see scripts/copy-ocr-assets.mjs. */
export const OCR_ASSET_PATHS = {
  workerPath: "/tesseract/worker.min.js",
  corePath: "/tesseract/core",
  langPath: "/tesseract/lang",
};

/** Below this, the read is too poor to be worth structuring. */
export const OCR_MIN_CONFIDENCE = 30;

/** Guards the structuring prompt against a runaway or garbage read. */
export const OCR_MAX_TEXT_LENGTH = 12_000;
