"use client";

/**
 * Enlarging a screenshot before reading it.
 *
 * A phone screenshot is a picture of text that was never printed. Tesseract
 * expects something scanned at around 300 dpi; a 1080px-wide screen renders its
 * small print at roughly half that, and the engine's line finder gives up on
 * exactly the characters that matter - the currency mark welded to a price, the
 * decimal point in a fee, a restaurant name set in grey beside a round back
 * button.
 *
 * Doubling the pixels and dropping the colour before the read fixes all three.
 * Measured in a browser across six real screenshots - two Talabat carts, two
 * payment summaries, a Noon cart and an ALBAIK cart - against the restaurant
 * name, item price and every figure in each summary: 13 of 17 read correctly
 * without this, 17 of 17 with it. "On The Wood" instead of "SMe", 87.00 instead
 * of nothing, and a complete payment summary instead of a subtotal on its own.
 *
 * Both halves earn their place, and only a browser could say so. Enlarging with
 * colour left in scored 14 of 17; three times the size scored 15 and took twice
 * as long again; an extra contrast push scored 15. Measuring this under Node
 * would have been misleading - sharp's resampling is not the canvas's, and it
 * made greyscale look unnecessary when in the browser it is the difference
 * between reading a price and inventing one.
 */

/** Doubling is what the measurements support; tripling costs more and reads worse. */
const SCALE = 2;

/**
 * Above this the enlargement is scaled back to fit.
 *
 * A 1080x2340 phone screenshot doubles to just over 10 MP, which is fine. The
 * cap is what stops a tablet screenshot, or a desktop capture someone sent from
 * their laptop, from asking a phone to allocate a canvas it cannot.
 */
const MAX_PIXELS = 12_000_000;

/**
 * Returns an enlarged copy, or the original when enlarging is not possible or
 * not worth it. Never throws: a failed preprocess must still leave a readable
 * image behind, because the alternative is a customer with no basket at all.
 */
export async function enlargeForOcr(image: Blob): Promise<Blob> {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") {
    return image;
  }

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(image);
    const { width, height } = bitmap;
    if (!width || !height) return image;

    // Scale back rather than skip: a large image still reads better enlarged a
    // little than not at all.
    const scale = Math.min(SCALE, Math.sqrt(MAX_PIXELS / (width * height)));
    if (scale <= 1.05) return image;

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);

    const context = canvas.getContext("2d");
    if (!context) return image;

    // Smoothing on: the engine reads interpolated strokes better than the
    // stair-stepped edges nearest-neighbour would give it.
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    // Applied by the compositor as it draws, so the colour costs nothing to
    // remove. Enlarging a JPEG spreads its colour fringing across the edges of
    // small glyphs, and the engine reads that fringing as extra strokes.
    context.filter = "grayscale(1)";
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    // PNG, not JPEG: this image exists only to be read, and JPEG artefacts on
    // small text are the very thing being fixed here.
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/png");
    });

    return blob ?? image;
  } catch {
    return image;
  } finally {
    bitmap?.close();
  }
}
