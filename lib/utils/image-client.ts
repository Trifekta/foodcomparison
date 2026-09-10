import {
  IMAGE_COMPRESSION_QUALITY,
  IMAGE_MAX_DIMENSION,
} from "@/lib/constants";

/**
 * Client-side downscaling.
 *
 * Phone screenshots are often 3-6 MB; a 1600px-wide JPEG stays perfectly
 * readable for an admin while uploading in a fraction of the time on a mobile
 * connection. If anything goes wrong we simply upload the original - the server
 * enforces the real limits either way.
 *
 * This only resizes. It does not read, parse or interpret the image.
 */
export async function downscaleImage(file: File): Promise<File> {
  if (typeof window === "undefined" || typeof createImageBitmap !== "function") {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;
    const longestEdge = Math.max(width, height);

    if (longestEdge <= IMAGE_MAX_DIMENSION) {
      bitmap.close();
      return file;
    }

    const scale = IMAGE_MAX_DIMENSION / longestEdge;
    const targetWidth = Math.round(width * scale);
    const targetHeight = Math.round(height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return file;
    }

    context.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", IMAGE_COMPRESSION_QUALITY);
    });

    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, "") || "screenshot";
    return new File([blob], `${name}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    return file;
  }
}
