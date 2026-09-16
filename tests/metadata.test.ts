import { readFileSync } from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from "@/lib/metadata";

/**
 * publicEnv reads process.env once, at module load, so every case here has to
 * set the variable and then import a fresh copy of the module graph.
 */
async function loadSocialCard(appUrl: string | undefined) {
  vi.resetModules();
  if (appUrl === undefined) vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
  else vi.stubEnv("NEXT_PUBLIC_APP_URL", appUrl);
  return (await import("@/lib/metadata")).socialCard;
}

/**
 * Metadata["twitter"] is a union, and only some members carry a card type.
 * Narrowing with `in` reads the field without asserting a shape onto it.
 */
function twitterCard(meta: Pick<Metadata, "twitter">): string | undefined {
  const { twitter } = meta;
  return twitter && "card" in twitter ? twitter.card : undefined;
}

const card = {
  title: "SnipSavor — your price check is ready",
  description: "We compared your order.",
  image: "/og/result.png",
  imageAlt: "SnipSavor",
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("socialCard", () => {
  it("makes the image absolute, because a scraper has no page to resolve against", async () => {
    const socialCard = await loadSocialCard("https://snipsavor.example");
    const { openGraph } = socialCard(card);

    expect(openGraph?.images).toEqual([
      {
        url: "https://snipsavor.example/og/result.png",
        width: OG_IMAGE_WIDTH,
        height: OG_IMAGE_HEIGHT,
        alt: "SnipSavor",
        type: "image/png",
      },
    ]);
  });

  it("drops the image rather than advertising localhost", async () => {
    const socialCard = await loadSocialCard(undefined);
    const { openGraph, twitter } = socialCard(card);

    expect(openGraph?.images).toBeUndefined();
    expect(JSON.stringify({ openGraph, twitter })).not.toContain("localhost");
    // Without an image there is no large card to ask for.
    expect(twitterCard({ twitter })).toBe("summary");
  });

  it("asks for the large card once there is an image to fill it", async () => {
    const socialCard = await loadSocialCard("https://snipsavor.example");
    expect(twitterCard(socialCard(card))).toBe("summary_large_image");
  });

  it("omits og:url unless a page asks for one", async () => {
    const socialCard = await loadSocialCard("https://snipsavor.example");
    // The result page passes no path: its address is the credential.
    expect(socialCard(card).openGraph).not.toHaveProperty("url");
    expect(socialCard({ ...card, path: "/" }).openGraph).toHaveProperty(
      "url",
      "https://snipsavor.example/",
    );
  });
});

/**
 * The tags promise a size. A card cropped differently would be silently
 * letterboxed or stretched by every reader, which is exactly the kind of thing
 * nobody notices until it is in somebody's chat.
 */
describe("the card artwork", () => {
  it.each(["default", "result"])("/og/%s.png is the size the tags claim", (name) => {
    const png = readFileSync(path.join(import.meta.dirname, "..", "public", "og", `${name}.png`));

    expect(png.subarray(1, 4).toString("ascii")).toBe("PNG");
    // IHDR is the first chunk: width and height are big-endian at bytes 16-23.
    expect(png.readUInt32BE(16)).toBe(OG_IMAGE_WIDTH);
    expect(png.readUInt32BE(20)).toBe(OG_IMAGE_HEIGHT);
  });
});
