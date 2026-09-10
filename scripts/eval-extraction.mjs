#!/usr/bin/env node
/**
 * Measures extraction accuracy against screenshots you have labelled by hand.
 *
 *   npm run extract:eval -- eval/shots
 *
 * Expects, for each screenshot, a sibling .json label file:
 *
 *   eval/shots/talabat-en-01.png
 *   eval/shots/talabat-en-01.json
 *
 * The label names the app and language so results can be broken down, and
 * states the truth as a human read it off the screen:
 *
 *   {
 *     "app": "talabat",            // talabat | careem | deliveroo | noon
 *     "language": "en",            // en | ar | mixed
 *     "restaurant_name": "Al Safadi Restaurant",
 *     "items": [
 *       { "name": "Chicken Shawarma Platter", "quantity": 2, "line_total": "64.00" }
 *     ],
 *     "final_total": "104.00"
 *   }
 *
 * It runs the same OCR settings the admin dashboard uses and the same
 * structuring prompt, then reports restaurant accuracy, item recall and
 * precision, quantity accuracy, price accuracy and total accuracy - overall,
 * per app, and per language.
 *
 * Costs real money: one model call per screenshot. Add --vision to measure the
 * fallback route instead of OCR.
 */

import { readdir, readFile } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";

const args = process.argv.slice(2);
const useVision = args.includes("--vision");
const dir = resolve(args.find((arg) => !arg.startsWith("--")) ?? "eval/shots");

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };

/** Compares loosely: OCR case and spacing noise is not a substantive error. */
const normalise = (value) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,](?=\s|$)/g, "")
    .trim();

const money = (value) => {
  const trimmed = String(value ?? "").trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : null;
};

/**
 * Pairs predicted items to expected ones by name.
 *
 * Exact-after-normalising first, then a containment fallback, because a model
 * that returns "Chicken Shawarma Platter (Large)" for "Chicken Shawarma Platter"
 * has found the item - counting that as a miss would flatter nothing and hide
 * the errors that matter.
 */
function pairItems(expected, predicted) {
  const pairs = [];
  const takenPredictions = new Set();

  for (const [expectedIndex, want] of expected.entries()) {
    const wantName = normalise(want.name);

    let matchIndex = predicted.findIndex(
      (got, index) => !takenPredictions.has(index) && normalise(got.name) === wantName,
    );

    if (matchIndex === -1) {
      matchIndex = predicted.findIndex((got, index) => {
        if (takenPredictions.has(index)) return false;
        const gotName = normalise(got.name);
        return gotName.includes(wantName) || wantName.includes(gotName);
      });
    }

    if (matchIndex !== -1) takenPredictions.add(matchIndex);
    pairs.push({ expectedIndex, want, got: matchIndex === -1 ? null : predicted[matchIndex] });
  }

  return { pairs, matched: takenPredictions.size };
}

class Tally {
  constructor() {
    this.counts = {};
  }
  add(metric, hit) {
    const entry = (this.counts[metric] ??= { hit: 0, total: 0 });
    entry.total += 1;
    if (hit) entry.hit += 1;
  }
  rate(metric) {
    const entry = this.counts[metric];
    if (!entry || entry.total === 0) return null;
    return entry.hit / entry.total;
  }
  get metrics() {
    return Object.keys(this.counts);
  }
}

function score(label, basket, tally) {
  tally.add("restaurant", normalise(basket.restaurant_name) === normalise(label.restaurant_name));

  const expected = label.items ?? [];
  const predicted = basket.items ?? [];
  const { pairs, matched } = pairItems(expected, predicted);

  for (let i = 0; i < expected.length; i += 1) tally.add("item recall", i < matched);
  for (let i = 0; i < predicted.length; i += 1) tally.add("item precision", i < matched);

  for (const { want, got } of pairs) {
    if (!got) continue;
    if (want.quantity !== undefined) tally.add("quantity", Number(want.quantity) === Number(got.quantity));
    if (want.line_total !== undefined) {
      tally.add("price", money(want.line_total) === money(got.line_total));
    }
  }

  if (label.final_total !== undefined) {
    tally.add("total", money(label.final_total) === money(basket.final_total));
  }
}

function percent(rate) {
  return rate === null ? "   —" : `${(rate * 100).toFixed(0).padStart(3)}%`;
}

function report(title, tally) {
  const metrics = ["restaurant", "item recall", "item precision", "quantity", "price", "total"];
  const row = metrics.map((metric) => percent(tally.rate(metric))).join("  ");
  console.log(`  ${title.padEnd(22)} ${row}`);
}

// ---------------------------------------------------------------------------

const entries = await readdir(dir).catch(() => null);
if (!entries) {
  console.error(`No such directory: ${dir}`);
  console.error("Put labelled screenshots there - see the header of this file.");
  process.exit(1);
}

const images = entries.filter((name) => IMAGE_EXTENSIONS.has(extname(name).toLowerCase()));
if (images.length === 0) {
  console.error(`No screenshots in ${dir}.`);
  process.exit(1);
}

// Imported straight from the app so the settings and the prompt cannot drift
// from what the dashboard actually runs. These three modules are dependency-free
// by design, which is what lets plain Node load them; lib/extraction/structure.ts
// cannot be imported here because it resolves Next's "@/" alias.
const { createWorker } = await import("tesseract.js");
const { default: Anthropic } = await import("@anthropic-ai/sdk");
const { zodOutputFormat } = await import("@anthropic-ai/sdk/helpers/zod");
const { OCR_LANGUAGES_STAFF, OCR_ENGINE_MODE, OCR_PARAMETERS } = await import(
  "../lib/ocr/config.ts"
);
const { structuredBasketSchema } = await import("../lib/extraction/schema.ts");
const {
  OCR_SYSTEM_PROMPT,
  OCR_USER_PROMPT,
  VISION_SYSTEM_PROMPT,
  VISION_USER_PROMPT,
  PROMPT_VERSION,
} = await import("../lib/extraction/prompt.ts");

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY is not set. Every screenshot costs one model call.");
  process.exit(1);
}

const model = process.env.EXTRACTION_MODEL || "claude-opus-5";
const anthropic = new Anthropic({ timeout: 120_000, maxRetries: 1 });

/**
 * The same call the app makes, minus the storage and audit plumbing.
 *
 * Never throws: one screenshot that fails - a rate limit, a refusal, a bad key -
 * is recorded as a failure and the run carries on. Aborting a thirty-screenshot
 * batch on the twenty-ninth would waste every call before it.
 */
async function structure(system, content) {
  const started = Date.now();

  try {
    const response = await anthropic.messages.parse({
      model,
      max_tokens: 8192,
      system,
      output_config: { effort: "low", format: zodOutputFormat(structuredBasketSchema) },
      messages: [{ role: "user", content }],
    });

    if (response.stop_reason === "refusal") return { ok: false, detail: "declined" };
    if (!response.parsed_output) return { ok: false, detail: "did not match the schema" };
    return { ok: true, basket: response.parsed_output, ms: Date.now() - started };
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message.split("\n")[0] : "failed" };
  }
}

const worker = useVision
  ? null
  : await (async () => {
      const created = await createWorker([...OCR_LANGUAGES_STAFF], OCR_ENGINE_MODE, {
        langPath: resolve("public/tesseract/lang"),
        logger: () => {},
      });
      await created.setParameters(OCR_PARAMETERS);
      return created;
    })();

const overall = new Tally();
const byApp = new Map();
const byLanguage = new Map();
let failures = 0;

for (const name of images.sort()) {
  const stem = basename(name, extname(name));
  const labelRaw = await readFile(join(dir, `${stem}.json`), "utf8").catch(() => null);

  if (!labelRaw) {
    console.log(`skip  ${name}  (no ${stem}.json label)`);
    continue;
  }

  const label = JSON.parse(labelRaw);
  const bytes = await readFile(join(dir, name));

  let basket;
  let detail = "";

  if (useVision) {
    const outcome = await structure(VISION_SYSTEM_PROMPT, [
      {
        type: "image",
        source: {
          type: "base64",
          media_type: MIME[extname(name).toLowerCase()],
          data: bytes.toString("base64"),
        },
      },
      { type: "text", text: VISION_USER_PROMPT },
    ]);

    if (!outcome.ok) {
      failures += 1;
      console.log(`FAIL  ${name}  ${outcome.detail}`);
      continue;
    }
    basket = outcome.basket;
    detail = `llm ${outcome.ms}ms`;
  } else {
    const started = Date.now();
    const { data } = await worker.recognize(bytes);
    const ocrMs = Date.now() - started;

    const outcome = await structure(
      OCR_SYSTEM_PROMPT,
      `${OCR_USER_PROMPT}\n\n<ocr_text>\n${data.text}\n</ocr_text>`,
    );

    if (!outcome.ok) {
      failures += 1;
      console.log(`FAIL  ${name}  ${outcome.detail}`);
      continue;
    }
    basket = outcome.basket;
    detail = `ocr ${ocrMs}ms conf ${data.confidence.toFixed(0)}%, llm ${outcome.ms}ms`;
  }

  for (const tally of [
    overall,
    (byApp.get(label.app) ?? byApp.set(label.app, new Tally()).get(label.app)),
    (byLanguage.get(label.language) ??
      byLanguage.set(label.language, new Tally()).get(label.language)),
  ]) {
    score(label, basket, tally);
  }

  console.log(`ok    ${name.padEnd(28)} ${detail}`);
}

if (worker) await worker.terminate();

const header = "                         rest.  recall  prec.   qty    price   total";
console.log(
  `\n${useVision ? "VISION FALLBACK" : "OCR → TEXT → MODEL"}   ` +
    `(${images.length} screenshots, ${failures} failed)  model ${model}, prompt ${PROMPT_VERSION}`,
);
console.log(header);
report("overall", overall);

if (byApp.size > 1) {
  console.log("\nby app");
  for (const [app, tally] of [...byApp].sort()) report(app, tally);
}
if (byLanguage.size > 1) {
  console.log("\nby language");
  for (const [language, tally] of [...byLanguage].sort()) report(language, tally);
}

console.log(
  "\nrecall = of the items really there, how many were found." +
    "\nprecision = of the items reported, how many were real." +
    "\nquantity and price are scored only on items that matched.\n",
);
