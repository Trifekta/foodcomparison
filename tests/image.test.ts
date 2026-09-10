import { describe, expect, it } from "vitest";
import { detectImageType, validateImageFile } from "@/lib/validation/image";
import { MAX_IMAGE_BYTES } from "@/lib/constants";

/** Minimal but genuine file signatures. */
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const WEBP = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);
const SVG = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
const ELF = new Uint8Array([0x7f, 0x45, 0x4c, 0x46, 2, 1, 1, 0, 0, 0, 0, 0]);
const HTML = new TextEncoder().encode("<!doctype html><script>alert(1)</script>");

function fileFrom(bytes: Uint8Array, name: string, type: string): File {
  return new File([bytes as unknown as BlobPart], name, { type });
}

describe("detectImageType", () => {
  it("recognises the three formats we accept", () => {
    expect(detectImageType(JPEG)).toBe("image/jpeg");
    expect(detectImageType(PNG)).toBe("image/png");
    expect(detectImageType(WEBP)).toBe("image/webp");
  });

  it("does not recognise SVG, HTML or executables", () => {
    expect(detectImageType(SVG)).toBeNull();
    expect(detectImageType(ELF)).toBeNull();
    expect(detectImageType(HTML)).toBeNull();
  });
});

describe("validateImageFile", () => {
  it("accepts a real PNG and reports its extension", async () => {
    const result = await validateImageFile(fileFrom(PNG, "cart.png", "image/png"), "cart");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.mimeType).toBe("image/png");
      expect(result.extension).toBe("png");
    }
  });

  it("rejects an executable disguised with an image name and MIME type", async () => {
    const result = await validateImageFile(fileFrom(ELF, "cart.png", "image/png"), "cart");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("Please upload a JPG, PNG or WEBP image.");
  });

  it("rejects an SVG even though it is nominally an image", async () => {
    const result = await validateImageFile(fileFrom(SVG, "cart.svg", "image/svg+xml"), "cart");
    expect(result.ok).toBe(false);
  });

  it("rejects a file over 10 MB before reading it", async () => {
    const file = fileFrom(PNG, "cart.png", "image/png");
    Object.defineProperty(file, "size", { value: MAX_IMAGE_BYTES + 1 });

    const result = await validateImageFile(file, "cart");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("This image is larger than 10 MB.");
  });

  it("rejects an empty file", async () => {
    const result = await validateImageFile(fileFrom(new Uint8Array(), "cart.png", "image/png"), "cart");
    expect(result.ok).toBe(false);
  });

  it("rejects a real image sent with a disallowed declared type", async () => {
    const result = await validateImageFile(fileFrom(PNG, "cart.png", "application/pdf"), "cart");
    expect(result.ok).toBe(false);
  });
});
