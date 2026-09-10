/**
 * What an OCR engine hands back, independent of which engine ran it.
 *
 * The admin dashboard currently fills this in the browser with tesseract.js and
 * the evaluation script fills it in Node with the same library. Swapping in a
 * server-side or hosted engine later means writing something else that returns
 * this shape; nothing downstream of here knows or cares which engine ran.
 */
export interface OcrResult {
  /** The complete raw text, preserved verbatim and stored as-is. */
  text: string;
  /** Mean engine confidence, 0-100. */
  confidence: number;
  /** Identifies the engine and settings, for the audit trail. */
  engine: string;
  /** Wall-clock milliseconds the read took. */
  durationMs: number;
}

export interface OcrFailure {
  ok: false;
  error: string;
}

export type OcrOutcome = ({ ok: true } & OcrResult) | OcrFailure;
