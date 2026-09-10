#!/usr/bin/env node
/**
 * Copies the OCR engine's runtime files out of node_modules and into public/.
 *
 * tesseract.js fetches its worker, its WASM core and its language data at
 * runtime, and defaults to a public CDN for all three. We serve them from our
 * own origin instead: the point of doing OCR in the browser is that the
 * screenshot stays with us, and that is undermined if reading it requires
 * calling out to jsdelivr on every submission.
 *
 * Runs before every build and before the dev server (see package.json). The
 * output is git-ignored - it is a copy of a dependency, not source.
 */

import { cp, mkdir, rm, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "public", "tesseract");

/** Only the LSTM builds: that is the engine mode we run. */
const CORE_VARIANTS = [
  "tesseract-core-lstm",
  "tesseract-core-simd-lstm",
  "tesseract-core-relaxedsimd-lstm",
];

const LANGUAGES = [
  ["@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz", "eng.traineddata.gz"],
  ["@tesseract.js-data/ara/4.0.0_best_int/ara.traineddata.gz", "ara.traineddata.gz"],
];

async function copy(from, to) {
  const source = join(root, "node_modules", from);
  if (!existsSync(source)) {
    throw new Error(
      `Missing ${from}. Run npm install before building - the OCR assets come from node_modules.`,
    );
  }
  await mkdir(dirname(to), { recursive: true });
  await cp(source, to);
  return (await stat(to)).size;
}

await rm(out, { recursive: true, force: true });

let total = 0;

total += await copy("tesseract.js/dist/worker.min.js", join(out, "worker.min.js"));

for (const variant of CORE_VARIANTS) {
  // Three files per variant, and all three are needed. The worker asks for
  // "<variant>.wasm.js" - the Emscripten loader - which then fetches
  // "<variant>.wasm". Shipping only the first two gets you a worker that fails
  // with a bare importScripts NetworkError and no indication of what is missing.
  for (const suffix of [".js", ".wasm", ".wasm.js"]) {
    total += await copy(
      `tesseract.js-core/${variant}${suffix}`,
      join(out, "core", `${variant}${suffix}`),
    );
  }
}

for (const [from, name] of LANGUAGES) {
  total += await copy(from, join(out, "lang", name));
}

console.log(`OCR assets → public/tesseract (${(total / 1024 / 1024).toFixed(1)} MB)`);
