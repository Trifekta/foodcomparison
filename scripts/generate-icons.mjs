/**
 * Renders every raster icon the site needs from app/icon.svg.
 *
 *   node scripts/generate-icons.mjs
 *
 * The SVG is the only place the mark is drawn. Everything here is a mechanical
 * reduction of it, committed rather than generated during the build, because a
 * build step that can silently produce a slightly different icon is a build step
 * nobody looks at. Re-run this whenever app/icon.svg changes and read the diff.
 *
 * Three renderings, because the platforms disagree about corners:
 *
 *   - as drawn, rounded, for the places that show an icon exactly as given
 *     (the manifest's "any" icons, the .ico)
 *   - full bleed, for apple-touch-icon: iOS rounds the corners itself, and an
 *     already-rounded source shows the page background in the gaps
 *   - full bleed and smaller, for Android's maskable icon, which may crop the
 *     tile to a circle and guarantees only the middle 80%
 *
 * sharp comes with Next (it is what next/image uses), so there is nothing extra
 * to install.
 */

import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
let sharp;
try {
  sharp = require("sharp");
} catch {
  console.error("sharp is missing - run `npm install` and try again.");
  process.exit(1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ICON = path.join(root, "app", "icon.svg");
const BADGE = path.join(root, "public", "icons", "badge.svg");

/** The tile's own gold. Kept in step with --color-brand-400 in globals.css. */
const GOLD = { r: 0xff, g: 0xd8, b: 0x4d, alpha: 1 };

/** The mark as drawn, at some pixel size. */
const rounded = (size) =>
  sharp(ICON, { density: 600 }).resize(size, size).png({ compressionLevel: 9 }).toBuffer();

/**
 * The mark on a square that reaches every edge, with the mark itself at
 * `scale` of it. The rounded corners vanish because what shows through them is
 * the same gold.
 */
async function bleed(size, scale = 1) {
  const inner = Math.round(size * scale);
  const mark = await rounded(inner);
  const offset = Math.round((size - inner) / 2);
  return sharp({ create: { width: size, height: size, channels: 4, background: GOLD } })
    .composite([{ input: mark, left: offset, top: offset }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/**
 * An .ico wrapping PNGs.
 *
 * Everything since Windows Vista reads PNG payloads inside an .ico, and the
 * alternative - a BMP with an upside-down bitmask - is a lot of bytes to hand
 * write for a format only /favicon.ico still needs. Sizes stay under 256 so the
 * byte that records them never has to mean "256" by being zero.
 */
async function ico(sizes) {
  const images = await Promise.all(sizes.map((size) => rounded(size)));
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // 1 = icon
  header.writeUInt16LE(sizes.length, 4);

  let offset = 6 + sizes.length * 16;
  const entries = images.map((png, i) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(sizes[i], 0);
    entry.writeUInt8(sizes[i], 1);
    entry.writeUInt8(0, 2); // palette size: none
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    return entry;
  });

  return Buffer.concat([header, ...entries, ...images]);
}

const out = async (relative, buffer) => {
  const file = path.join(root, relative);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, buffer);
  console.log(`  ${relative}  ${(buffer.length / 1024).toFixed(1)} kB`);
};

console.log("Rendering icons from app/icon.svg");

// For everything that asks for /favicon.ico by reflex rather than by reading
// the page: crawlers, feed readers, link unfurlers, and browsers old enough to
// want an .ico. Next links it alongside the SVG, and modern browsers prefer the
// SVG, so this is the fallback rather than the main event.
await out("app/favicon.ico", await ico([16, 32, 48]));

// iOS home screen - 180 is the largest size any iPhone asks for.
await out("app/apple-icon.png", await bleed(180));

// The manifest's icons: one for the launcher, one for the install prompt and
// the splash screen.
await out("public/icons/icon-192.png", await rounded(192));
await out("public/icons/icon-512.png", await rounded(512));

// Android may crop a maskable icon to a circle, and promises only the middle
// 80% survives. The crop frame's rounded corners are what a tighter fit would
// slice off first; at 0.66 they sit about 13px inside that circle at 512.
await out("public/icons/maskable-512.png", await bleed(512, 0.66));

// Alpha only - see public/icons/badge.svg.
await out(
  "public/icons/badge.png",
  await sharp(BADGE, { density: 600 }).resize(96, 96).png({ compressionLevel: 9 }).toBuffer(),
);

console.log("Done.");
