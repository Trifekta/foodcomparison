/**
 * OCR settings, shared by every place that runs it.
 *
 * The browser (admin dashboard) and Node (the evaluation script) both read
 * from here so that what you measure offline is what the admin actually gets.
 * Divergence between the two would make the accuracy numbers meaningless.
 */

/**
 * Which languages to load, and it is not the same answer in both places.
 *
 * Customers get English only. The language files dominate the download - Arabic
 * is 1.6 MB of a 6 MB first load - and every megabyte is paid for on a phone,
 * on mobile data, at the exact moment we are trying to convince someone the
 * product is worth using. A single-script model is also faster and often more
 * accurate, because the engine is not weighing two alphabets against each other.
 *
 * Staff get both. They are on a desk, on wifi, and the Arabic screenshots are
 * precisely the ones that reach a human because nothing else could read them.
 */
export const OCR_LANGUAGES_CUSTOMER = ["eng"] as const;
export const OCR_LANGUAGES_STAFF = ["eng", "ara"] as const;

/**
 * LSTM only. The legacy engine is faster but markedly worse on the small,
 * anti-aliased text in a phone screenshot, and worse again on Arabic.
 */
export const OCR_ENGINE_MODE = 1;

/**
 * Recorded against every extraction so a change in reading behaviour is
 * traceable. Bump it whenever anything in this file changes.
 */
export function ocrEngineVersion(languages: readonly string[]): string {
  return `tesseract.js@7 lstm ${languages.join("+")} v1`;
}

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
