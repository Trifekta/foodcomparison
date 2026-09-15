"use client";

/**
 * Making the screenshot small enough to send over a phone's data.
 *
 * A modern phone screenshot is a two to four megabyte PNG, and a submission
 * sends two of them. On café wifi that is a pause; on 4G at the moment somebody
 * has decided to try this product, it is long enough to wonder whether the
 * button worked. The bytes are the wait - everything else in the submission is a
 * handful of small queries.
 *
 * Nothing needs that resolution. The screenshot is read by OCR, which already
 * rescales it, and then looked at by an admin rebuilding a basket - both want a
 * legible phone screen, not a lossless one. Downscaled to a long edge of 1800
 * and encoded as JPEG, a typical cart screenshot lands between 150 and 400 KB:
 * an order of magnitude less to upload, and still comfortably readable.
 *
 * Every failure path returns the original file. A screenshot that arrives slowly
 * is a worse experience; a screenshot that does not arrive is a lost customer.
 */

/** Long edge, in pixels. Enough to read a phone screenshot's smallest text. */
const MAX_EDGE = 1800;

/** Below this there is nothing worth winning, and re-encoding only loses detail. */
const LEAVE_ALONE_BYTES = 400 * 1024;

const QUALITY = 0.82;

export async function compressForUpload(file: File): Promise<File> {
  try {
    if (file.size <= LEAVE_ALONE_BYTES) return file;
    if (typeof createImageBitmap !== "function" || typeof document === "undefined") return file;

    const bitmap = await createImageBitmap(file);
    const longest = Math.max(bitmap.width, bitmap.height);
    const scale = longest > MAX_EDGE ? MAX_EDGE / longest : 1;

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);

    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close?.();
      return file;
    }

    // White underneath, because a screenshot carrying transparency would
    // otherwise flatten onto black and become unreadable.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", QUALITY),
    );

    // Re-encoding does not always win - a screenshot of flat colour can compress
    // better as the PNG it already was. Keep whichever is smaller.
    if (!blob || blob.size >= file.size) return file;

    return new File([blob], replaceExtension(file.name), {
      type: "image/jpeg",
      lastModified: file.lastModified,
    });
  } catch {
    // Out of memory on an old phone, a codec that will not decode, a canvas the
    // browser refuses to allocate. None of them are worth a failed submission.
    return file;
  }
}

function replaceExtension(name: string): string {
  const base = name.replace(/\.[^./\\]+$/, "");
  return `${base || "screenshot"}.jpg`;
}
