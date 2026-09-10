import {
  ACCEPTED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
} from "@/lib/constants";

/**
 * Server-side image validation.
 *
 * The declared MIME type and the filename extension are both attacker-controlled,
 * so the real check is on the file's magic bytes. Anything that is not a JPEG,
 * PNG or WEBP is rejected outright, which keeps executables and SVGs (script
 * capable) out of storage.
 */

export type DetectedImageType = "image/jpeg" | "image/png" | "image/webp";

export interface ImageValidationSuccess {
  ok: true;
  mimeType: DetectedImageType;
  extension: "jpg" | "png" | "webp";
  bytes: Uint8Array;
}

export interface ImageValidationFailure {
  ok: false;
  error: string;
}

export type ImageValidationResult = ImageValidationSuccess | ImageValidationFailure;

const EXTENSION_BY_TYPE: Record<DetectedImageType, "jpg" | "png" | "webp"> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Detects the image type from the file signature, or null if unrecognised. */
export function detectImageType(bytes: Uint8Array): DetectedImageType | null {
  if (bytes.length < 12) return null;

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (png.every((byte, index) => bytes[index] === byte)) {
    return "image/png";
  }

  // WEBP: "RIFF" .... "WEBP"
  const riff = [0x52, 0x49, 0x46, 0x46];
  const webp = [0x57, 0x45, 0x42, 0x50];
  if (
    riff.every((byte, index) => bytes[index] === byte) &&
    webp.every((byte, index) => bytes[index + 8] === byte)
  ) {
    return "image/webp";
  }

  return null;
}

export async function validateImageFile(
  file: File,
  label: string,
): Promise<ImageValidationResult> {
  if (file.size === 0) {
    return { ok: false, error: `Your ${label} looks empty. Please upload it again.` };
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, error: "This image is larger than 10 MB." };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const detected = detectImageType(bytes);

  if (!detected) {
    return { ok: false, error: "Please upload a JPG, PNG or WEBP image." };
  }

  // The declared type must not contradict the real one.
  if (
    file.type &&
    !(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)
  ) {
    return { ok: false, error: "Please upload a JPG, PNG or WEBP image." };
  }

  return {
    ok: true,
    mimeType: detected,
    extension: EXTENSION_BY_TYPE[detected],
    bytes,
  };
}
