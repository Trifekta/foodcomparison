#!/usr/bin/env node
/**
 * Runs real screenshots through the real reading endpoint and prints what came
 * back, so you can judge accuracy before trusting it with customers.
 *
 *   npm run dev                                   # in one terminal
 *   npm run extract:try -- shots/*.png            # in another
 *
 * It posts to the running app rather than importing the extractor directly, so
 * what you are measuring is the exact path a customer takes: the same
 * magic-byte check, the same prompt, the same cleaning rules, the same JSON the
 * browser receives. Nothing is written to the database.
 */

import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";

const BASE = process.env.EXTRACT_URL ?? "http://localhost:3000";

const MIME = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

const files = process.argv.slice(2);

if (files.length === 0) {
  console.error("Usage: npm run extract:try -- <screenshot> [more...]");
  console.error("Optional: EXTRACT_URL=https://your-domain npm run extract:try -- shot.png");
  process.exit(1);
}

let readable = 0;

for (const path of files) {
  const label = basename(path);
  const mime = MIME[extname(path).toLowerCase()];

  if (!mime) {
    console.log(`\n${label}\n  skipped - not a jpg, png or webp`);
    continue;
  }

  const body = new FormData();
  body.append("cartImage", new Blob([await readFile(path)], { type: mime }), label);

  const startedAt = Date.now();
  let result;
  try {
    const response = await fetch(`${BASE}/api/extract`, { method: "POST", body });
    result = await response.json();
  } catch (error) {
    console.log(`\n${label}\n  request failed: ${error.message}`);
    console.log(`  is the app running at ${BASE}?`);
    continue;
  }
  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);

  console.log(`\n${label}  (${seconds}s)`);

  if (!result.readable) {
    // Also what you get with no API key set, or when the call failed - the
    // endpoint deliberately does not distinguish those for the customer.
    console.log("  not readable (unreadable image, no API key, or the call failed)");
    continue;
  }

  readable += 1;
  console.log(`  restaurant: ${result.restaurantName ?? "(none read)"}`);
  console.log(`  total:      ${result.orderTotal ?? "(none read)"}`);

  if (result.items.length === 0) {
    console.log("  items:      (none read)");
    continue;
  }

  const width = Math.max(...result.items.map((item) => item.name.length));
  console.log("  items:");
  for (const item of result.items) {
    const price = item.linePrice === null ? "—" : `AED ${item.linePrice}`;
    console.log(`    ${item.name.padEnd(width)}  x${String(item.quantity).padEnd(3)} ${price}`);
  }
}

console.log(`\n${readable} of ${files.length} read.\n`);
console.log("Compare each against the screenshot itself. What matters is not a");
console.log("perfect read - the customer corrects it - but whether correcting it");
console.log("is less work than typing the basket from scratch.");
