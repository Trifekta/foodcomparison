import { emptyBasket, type StructuredBasket, type StructuredItem } from "./schema";

/**
 * Turns raw OCR text into a basket, with rules rather than a model.
 *
 * This is the free path: it runs in the customer's browser, costs nothing, and
 * needs no API account. It is meaningfully worse than asking a model - it works
 * from layout and keywords, so an unusual receipt shape defeats it - but for a
 * screen whose job is "here is what we read, fix anything wrong", roughly right
 * and editable beats nothing at all.
 *
 * It reads a receipt the way the eye does: a name opens a row, description
 * lines hang under it, and the price closes it - whether that price sits on the
 * same line or several lines below, which differs by app. Headings like "You
 * might also like" close the item list, because everything after them is an
 * upsell the customer never ordered.
 *
 * Deliberately not per-app. No Talabat branch, no Careem branch. A layout that
 * defeats these rules should be fixed by the customer on the confirm screen and
 * noticed in the numbers, not patched with a special case per brand.
 */

/** Arabic-Indic and Eastern Arabic-Indic digits, so ٣ counts as 3. */
const EASTERN_DIGITS = /[٠-٩۰-۹]/g;

function westernise(text: string): string {
  return text.replace(EASTERN_DIGITS, (digit) => {
    const code = digit.charCodeAt(0);
    const base = code >= 0x06f0 ? 0x06f0 : 0x0660;
    return String(code - base);
  });
}

/**
 * Words that mean a line is a total or a fee rather than something you eat.
 * English and Arabic, because a Dubai receipt may be in either.
 */
const KEYWORDS = {
  subtotal: ["subtotal", "sub total", "sub-total", "المجموع الفرعي", "المجموع الجزئي"],
  delivery_fee: ["delivery", "توصيل", "التوصيل"],
  service_fee: ["service", "service charge", "خدمة", "رسوم الخدمة"],
  discount: ["discount", "promo", "voucher", "coupon", "offer", "خصم", "كوبون"],
  final_total: ["total", "amount due", "to pay", "grand total", "الإجمالي", "المجموع", "الاجمالي"],
} as const;

/** Short lines that are app chrome, not content. */
const NOISE = [
  "cart",
  "your order",
  "order summary",
  "checkout",
  "basket",
  "add items",
  "add item",
  "view menu",
  "edit",
  "remove",
  "upgrade",
  "submit",
  "السلة",
  "الطلب",
];

/**
 * Headings after which nothing is part of the order any more.
 *
 * Every delivery app follows the basket with upsells and settings - "You might
 * also like", cutlery toggles, special requests. Those carry names and prices
 * and read exactly like items, so without this the customer is shown sauces
 * they never ordered.
 *
 * This closes the ITEM list only. Fees and totals are still collected past it,
 * because on a checkout screen the payment summary comes after all of this.
 */
const ITEM_SECTION_ENDS = [
  "you might also like",
  "you may also like",
  "recommended",
  "frequently bought",
  "popular with",
  "complete your meal",
  "add more",
  "special request",
  "special instruction",
  "cutlery",
  "save on your order",
  "payment summary",
  "قد يعجبك",
  "طلبات خاصة",
];

/** A phone status bar: the clock, signal bars and battery across the top. */
const STATUS_BAR = /^\s*\d{1,2}[:.]\d{2}\b/;

/** Leading back-arrow glyphs OCR leaves on a header line. */
const NAV_GLYPHS = /^[\s<>«»‹›|:;.,*+~^`'"-]+/;

/**
 * Punctuation OCR leaves dangling at the end of a wrapped line, usually the
 * remains of a divider or an icon it could not identify.
 */
const TRAILING_JUNK = /[\s:;,|!*+~^`'"\-]+$/;

function tidy(text: string): string {
  return text.replace(TRAILING_JUNK, "").trim();
}

const VAT_WORDS = ["vat", "tax", "ضريبة"];

/** Letters only - digits and glyphs do not make a line a name. */
function letterCount(text: string): number {
  return (text.match(/\p{L}/gu) ?? []).length;
}

/** How many money-shaped numbers are on this line. */
function countPrices(line: string): number {
  return (line.match(/\d{1,5}\.\d{1,2}/g) ?? []).length;
}

type FinancialKey = keyof typeof KEYWORDS;

function matches(haystack: string, needles: readonly string[]): boolean {
  return needles.some((needle) => haystack.includes(needle));
}

/**
 * Pulls the price off a line.
 *
 * Not simply the last number. A line carries several: "2 x Shawarma AED 64.00"
 * opens with a quantity, and an Arabic row runs right-to-left so the price can
 * come first - "AED 24.00 x 3 عصير برتقال". So candidates are scored, and a
 * currency marker or a decimal point beats mere position. Without that, the
 * quantity gets stored as the price.
 */
function extractPrice(line: string): { price: string; rest: string } | null {
  const cleaned = line.replace(/,(?=\d{3}\b)/g, "");
  // The trailing currency group carries a lookahead so it cannot claim a marker
  // that belongs to the NEXT number: in "Wings x3 AED 45.00" the "AED" is the
  // price's, not the quantity's, and without this "3" wins and the wings cost
  // three dirhams.
  const pattern =
    /(AED|aed|د\.?إ\.?|dhs?|dirhams?)?\s*(\d{1,5}(?:\.\d{1,2})?)(?:\s*(AED|aed|د\.?إ\.?|dhs?|dirhams?)(?!\s*\d))?/gi;

  let best: { value: string; start: number; end: number; score: number } | null = null;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(cleaned)) !== null) {
    if (match[0].trim() === "") continue;

    const hasCurrency = Boolean(match[1] || match[3]);
    const hasDecimal = match[2].includes(".");
    // Decimals outrank currency markers. Prices carry fils far more reliably
    // than they carry a legible "AED", and OCR drops the symbol more often than
    // it drops the point. A bare integer is usually a quantity.
    const score = (hasDecimal ? 4 : 0) + (hasCurrency ? 2 : 0);

    const candidate = {
      value: match[2],
      start: match.index,
      end: match.index + match[0].length,
      score,
    };

    // Later wins only among equally good candidates, so a trailing bare digit
    // cannot displace a currency-marked amount earlier in the line.
    if (!best || candidate.score >= best.score) best = candidate;
  }

  if (!best) return null;
  // Nothing on the line looks like money at all.
  if (best.score === 0 && !/^\s*\d+\s*$/.test(cleaned)) return null;

  const rest = (cleaned.slice(0, best.start) + " " + cleaned.slice(best.end))
    .replace(/\s+/g, " ")
    .trim();

  return { price: best.value, rest };
}

/**
 * Reads a quantity off the text around an item name.
 * Handles "2 x Name", "Name x2", "2× Name" and the Arabic "Name × ٣".
 */
function extractQuantity(text: string): { quantity: number; name: string } {
  const patterns: Array<[RegExp, number]> = [
    [/^\s*(\d{1,2})\s*[x×*]\s*/i, 1],
    [/\s*[x×*]\s*(\d{1,2})\s*$/i, 1],
    [/^\s*[x×*]\s*(\d{1,2})\s+/i, 1],
    [/\s*[x×*]\s*(\d{1,2})\s*[-–—]\s*/i, 1],
  ];

  for (const [pattern, group] of patterns) {
    const match = text.match(pattern);
    if (!match) continue;

    const quantity = Number(match[group]);
    const name = text.replace(pattern, " ").replace(/\s+/g, " ").trim();

    // The marker is stripped either way. A quantity OCR misread as 0 - which
    // happens with Arabic-Indic digits - still means the marker was there, and
    // leaving "x 0" glued to the dish name helps nobody.
    return { quantity: quantity >= 1 && quantity <= 99 ? quantity : 1, name };
  }

  return { quantity: 1, name: text.trim() };
}

/** Does this line look like a heading or a fee rather than a dish? */
function financialKey(lower: string): FinancialKey | null {
  // Subtotal before total: "subtotal" contains "total".
  const order: FinancialKey[] = ["subtotal", "delivery_fee", "service_fee", "discount", "final_total"];
  for (const key of order) {
    if (matches(lower, KEYWORDS[key])) return key;
  }
  return null;
}

/**
 * Undoes a currency glyph that OCR merged into the number.
 *
 * The AED mark renders as a shape Tesseract has no letter for, so reading in
 * English it becomes a digit stuck to the front: "36.00" comes back as "836.00",
 * "1.80" as "51.80". Silently showing a customer a 836 dirham subtotal is far
 * worse than showing nothing.
 *
 * The fix is only applied when it can be PROVEN, not guessed. A receipt states
 * its own arithmetic - components add up to the total - so every combination of
 * "drop the leading digit" is tried and one is accepted only if it makes the
 * sum reconcile and no other combination does. If nothing reconciles, or the
 * answer is ambiguous, everything is left exactly as it was read.
 *
 * Returns the paths it changed, so they can be flagged for a human to check.
 */
function repairMergedCurrency(basket: StructuredBasket): string[] {
  const total = Number(basket.final_total);
  if (!Number.isFinite(total) || total <= 0) return [];

  const fields = ["subtotal", "delivery_fee", "service_fee", "discount"] as const;
  type MoneyField = (typeof fields)[number];
  const present = fields.filter((field) => basket[field] !== "");
  if (present.length === 0) return [];

  const sum = (values: Record<string, number>) =>
    (values.subtotal ?? 0) + (values.delivery_fee ?? 0) + (values.service_fee ?? 0) -
    (values.discount ?? 0);

  const asRead: Record<string, number> = {};
  for (const field of present) asRead[field] = Number(basket[field]);
  // Already consistent: nothing to repair, and nothing to risk.
  if (Math.abs(sum(asRead) - total) < 0.02) return [];

  const reconciling: Array<{ values: Record<string, number>; changed: MoneyField[] }> = [];

  for (let mask = 1; mask < 1 << present.length; mask += 1) {
    const values = { ...asRead };
    const changed: MoneyField[] = [];
    let viable = true;

    present.forEach((field, index) => {
      if (!(mask & (1 << index))) return;
      const stripped = stripLeadingDigit(basket[field]);
      if (stripped === null) {
        viable = false;
        return;
      }
      values[field] = Number(stripped);
      changed.push(field);
    });

    if (viable && Math.abs(sum(values) - total) < 0.02) reconciling.push({ values, changed });
  }

  // Exactly one answer, or none. Two would mean guessing.
  if (reconciling.length !== 1) return [];

  const [{ values, changed }] = reconciling;
  for (const field of changed) basket[field] = values[field].toFixed(2);
  return changed;
}

/** "836.00" -> "36.00". Null when there is no leading digit to spare. */
function stripLeadingDigit(value: string): string | null {
  const match = value.match(/^\d(\d+(?:\.\d{1,2})?)$/);
  return match ? match[1] : null;
}

export interface ParseResult {
  basket: StructuredBasket;
  /** True when nothing recognisable came out, so the caller can stay quiet. */
  empty: boolean;
}

export function parseOcrText(raw: string): ParseResult {
  const basket = emptyBasket();
  const uncertain = new Set<string>();

  // Blank lines are KEPT. They are the only signal separating an item from its
  // own description: a delivery app prints the name, the contents, the price as
  // one block, then a gap before the next item. Discarding them means every
  // description after a priced item looks like a new item.
  const lines = westernise(raw)
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim());

  const items: StructuredItem[] = [];

  /**
   * The item currently being assembled.
   *
   * Delivery apps stack a row vertically - name, then description, then the
   * price several lines down, with the photo off to the right. So an item is
   * opened by a name and closed either by its price arriving on a later line or
   * by the next item starting.
   */
  let pending: StructuredItem | null = null;
  /** Set once an upsell or settings heading is passed; items stop, money does not. */
  let itemsClosed = false;

  const flush = () => {
    if (pending && letterCount(pending.name) >= 2) {
      pending.name = tidy(pending.name);
      pending.modifiers = pending.modifiers.map(tidy).filter((entry) => letterCount(entry) >= 2);
      items.push(pending);
    }
    pending = null;
  };

  for (const [index, original] of lines.entries()) {
    // The phone's own clock and battery, only ever the first line.
    if (index === 0 && STATUS_BAR.test(original)) continue;

    // A gap ends whatever row we were assembling.
    if (original === "") {
      flush();
      continue;
    }

    const line = original.replace(NAV_GLYPHS, "").trim();
    if (line === "") continue;
    const lower = line.toLowerCase();

    if (matches(lower, ITEM_SECTION_ENDS)) {
      flush();
      itemsClosed = true;
      continue;
    }

    // Chrome, matched only on short lines so a dish called "Edit-style Wrap"
    // survives.
    if (line.length <= 24 && matches(lower, NOISE)) continue;

    const key = financialKey(lower);
    const priced = extractPrice(line);
    const isFree = /\bfree\b|مجان/.test(lower) && key !== "final_total";

    // ---- fees, subtotal, total --------------------------------------------
    if (key && (priced || isFree)) {
      flush();
      if (matches(lower, VAT_WORDS) && key !== "final_total") continue;
      // "Free delivery" with the old price struck through beside it is zero,
      // not 2.90 - and often the struck price does not survive OCR at all.
      const value = isFree ? "0.00" : (priced as { price: string }).price;
      if (key === "final_total" || basket[key] === "") basket[key] = value;
      continue;
    }
    if (key) continue;

    if (itemsClosed) continue;

    // A row of upsell cards puts several prices on one line. It is never an item.
    if (countPrices(line) >= 3) continue;

    // Quantity steppers and stray glyphs: too few letters to be a name.
    if (letterCount(line) < 3) {
      // Unless it is nothing but a price, which belongs to the item above.
      if (priced && pending && pending.line_total === "" && letterCount(priced.rest) < 3) {
        pending.line_total = priced.price;
      }
      continue;
    }

    // ---- a name and its price on one line ---------------------------------
    // Left open rather than pushed straight away: descriptions can follow the
    // price as well as precede it, depending on the app.
    if (priced && letterCount(priced.rest) >= 2) {
      flush();
      const { quantity, name } = extractQuantity(priced.rest);
      pending = { name, quantity, modifiers: [], unit_price: "", line_total: priced.price };
      continue;
    }

    // ---- a price on its own line: it belongs to the item above -------------
    if (priced && letterCount(priced.rest) < 3) {
      if (pending && pending.line_total === "") pending.line_total = priced.price;
      continue;
    }

    // ---- text with no price ------------------------------------------------
    if (basket.restaurant_name === "" && items.length === 0 && pending === null) {
      basket.restaurant_name = line;
      // Rules cannot tell a restaurant from a section heading, so this is
      // always worth the customer's eye.
      uncertain.add("restaurant_name");
      continue;
    }

    if (pending === null) {
      const { quantity, name } = extractQuantity(line);
      pending = { name, quantity, modifiers: [], unit_price: "", line_total: "" };
      continue;
    }

    // Description lines under an item are its options.
    if (line.length <= 90 && pending.modifiers.length < 4) pending.modifiers.push(line);
  }

  flush();

  basket.items = items;
  for (const field of repairMergedCurrency(basket)) uncertain.add(field);

  // A rules parser guesses more than a model does, so it says so. Prices it
  // found are worth a glance; a basket with no total is worth more of one.
  for (const [index] of items.entries()) {
    uncertain.add(`items[${index}].line_total`);
  }
  if (basket.final_total === "") uncertain.add("final_total");

  basket.uncertain_fields = [...uncertain];

  return {
    basket,
    empty: items.length === 0 && basket.restaurant_name === "" && basket.final_total === "",
  };
}
