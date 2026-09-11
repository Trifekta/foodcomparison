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
  "pairs well with",
  "goes well with",
  "others also ordered",
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

/**
 * The same status bar when the clock did not survive the read.
 *
 * "10:15" came back as "M015" once the screenshot was enlarged, and the line
 * became the restaurant name. The clock is the unreliable part; the rest of the
 * bar is not. Signal bars and a battery read as a handful of two- and
 * three-letter fragments - "8 Zo all al", "XR ED)" - and nothing anybody names
 * a restaurant is made only of words that short. Checked on the first line
 * alone, where the bar is the only thing that can be.
 */
function looksLikeStatusBar(line: string): boolean {
  return STATUS_BAR.test(line) || (/\d/.test(line) && longestWord(line) < 4);
}

/** Leading back-arrow glyphs OCR leaves on a header line. */
const NAV_GLYPHS = /^[\s<>«»‹›|:;.,*+~^`'"&€£©®@#()\[\]{}-]+/;

/**
 * Punctuation OCR leaves dangling at the end of a wrapped line, usually the
 * remains of a divider or an icon it could not identify.
 */
const TRAILING_JUNK = /[\s:;,|!*+~^`'"\-]+$/;

function tidy(text: string): string {
  // Only punctuation is trimmed. Stripping short trailing tokens was tried and
  // reverted: it cleans "\y a3" off a name, but it also eats the "1" from
  // "Special Set Menu Serves 1", and losing real words costs more than leaving
  // noise the customer can see and delete.
  return text.replace(TRAILING_JUNK, "").trim();
}

/**
 * A name split across two lines by the column being narrow.
 *
 * "Make Your Own Wok Box (Non" / "Veg)" is one dish, and the unclosed bracket
 * says so - the continuation is not a description, it is the rest of the name.
 */
function awaitsContinuation(name: string): boolean {
  const opens = (name.match(/\(/g) ?? []).length;
  const closes = (name.match(/\)/g) ?? []).length;
  return opens > closes;
}

/**
 * Marketing and page furniture that carries a price.
 *
 * "Congrats! You saved AED 4.90" reads exactly like an item to a rules parser:
 * words, then money. Unlike NOISE these are matched at any line length, because
 * a banner is a sentence.
 *
 * These are deliberately STEMS, not whole phrases. "earn a stamp" came back
 * from a second reading of the same screenshot as "earn a star", and an exact
 * phrase misses that; "earn a" does not. Every entry here is chosen to be the
 * part of the sentence least likely to be mangled, and short enough that OCR
 * has fewer characters to get wrong.
 */
const PROMO = [
  "congrats",
  "place your order",
  "earn a",
  "saved",
  "saving",
  "cashback",
  "get extra",
  "no coupons apply",
  "place order",
  "to get free delivery",
  "delivering in",
  "yearly plan",
  "% off",
  "مبروك",
];

const VAT_WORDS = ["vat", "tax", "ضريبة"];

/**
 * Banners that name a fee you are not being charged.
 *
 * "Add AED 2.00 to get free delivery" carries the word delivery, a price and
 * the word free, so the fee rules read it as delivery costing nothing - on a
 * screen that goes on to charge 4.90 for it. What separates it from "Your
 * delivery is FREE", which really is the fee, is that it is conditional: it
 * describes what you would have to do, not what you are paying.
 */
const OFFER_CONDITIONS = [
  "to get free",
  "to unlock",
  "to maximize",
  "to maximise",
  "away from free",
];

/**
 * Above this, a single line item is worth a second look.
 *
 * Not a correction - the value is left exactly as read. It is a flag, because
 * the commonest way a price goes wrong is the AED glyph being read as a digit
 * welded to the front: 39.00 arriving as 539.00. When there is a total to
 * reconcile against that gets repaired outright; when there is not, saying
 * "check this" is the honest alternative to guessing.
 */
const IMPLAUSIBLE_ITEM_PRICE = 300;

/**
 * Digits the AED glyph is actually misread as, and the price above which that
 * becomes the likelier explanation than a genuinely expensive dish.
 *
 * Reading English, Tesseract has no letter for د.إ and reaches for the nearest
 * shape. Across real screenshots that has been 5 or 8 welded to the front of the
 * number: 28.00 arriving as 528.00, 39.00 as 539.00, 36.00 as 836.00.
 *
 * Unlike the arithmetic repair further down, this is a HEURISTIC - there is no
 * proof, only a strong prior. It is kept narrow on purpose (both the digit and
 * the threshold must match) and every price it touches is flagged for the
 * customer, because the alternative is showing someone AED 528 for a wok box.
 */
const GLYPH_DIGITS = ["5", "8"];
const GLYPH_STRIP_ABOVE = 500;

/** Drops a leading currency glyph misread as a digit, or returns null. */
function withoutGlyphDigit(price: string): string | null {
  if (!GLYPH_DIGITS.includes(price[0] ?? "")) return null;
  if (Number(price) <= GLYPH_STRIP_ABOVE) return null;

  const stripped = stripLeadingDigit(price);
  if (stripped === null) return null;
  return Number(stripped) >= 1 ? stripped : null;
}

/** Letters only - digits and glyphs do not make a line a name. */
function letterCount(text: string): number {
  return (text.match(/\p{L}/gu) ?? []).length;
}

/** How many money-shaped numbers are on this line. */
function countPrices(line: string): number {
  return (line.match(/\d{1,5}\.\d{1,2}/g) ?? []).length;
}

/**
 * A row of cards laid out side by side, rather than one thing you ordered.
 *
 * This is why OCR runs with preserve_interword_spaces: the gaps between columns
 * survive, and a shelf of upsell cards reads as three or four names separated by
 * wide runs of space. An ordinary item line has at most one such gap - the one
 * between its name and its price - so two or more means columns.
 *
 * It matters because the heading above the shelf ("You might also like") is
 * often scrolled off the top of the screenshot, leaving nothing else to go on.
 */
function looksLikeCardRow(rawLine: string): boolean {
  return (rawLine.match(/\S {4,}(?=\S)/g) ?? []).length >= 2;
}

/** The longest run of letters on a line, which is what tells a word from noise. */
function longestWord(text: string): number {
  return (text.match(/\p{L}+/gu) ?? []).reduce((longest, word) => Math.max(longest, word.length), 0);
}

/**
 * Drops the debris OCR leaves out to the right of an item.
 *
 * A delivery app puts a photo of the dish beside its name, and the engine reads
 * the picture: "Manoushe Box (12 pieces)" comes back with "Br Pn ”" trailing it
 * across the gap where the photo was.
 *
 * The gap is the evidence, which is why this is safe where trimming short
 * trailing words was not. Only a tail that sits beyond a column gap is even
 * considered, and only then when it carries no digits, no word long enough to
 * be a word, and either several fragments or a character no menu would print.
 * A size suffix - "Cappuccino      L" - fails all of that and survives.
 */
function withoutJunkTail(rawLine: string): string {
  const gap = /\S {4,}(?=\S)/g;
  let lastEnd = -1;
  let match: RegExpExecArray | null;
  while ((match = gap.exec(rawLine)) !== null) lastEnd = match.index + match[0].length;
  if (lastEnd < 0) return rawLine;

  const head = rawLine.slice(0, lastEnd);
  const tail = rawLine.slice(lastEnd).trim();

  if (/\d/.test(tail)) return rawLine;
  if (longestWord(tail) >= 4) return rawLine;
  if (letterCount(head) < 3) return rawLine;

  const fragments = tail.split(/\s+/).filter(Boolean).length;
  const hasOddCharacter = /[^\p{L}\d\s]/u.test(tail);
  if (fragments < 2 && !hasOddCharacter) return rawLine;

  return head;
}

/** Every money-shaped value on a line, in the order they appear. */
function allPrices(line: string): string[] {
  return line.match(/\d{1,5}\.\d{1,2}/g) ?? [];
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
 * Undoes what OCR did to the numbers, using the receipt's own arithmetic.
 *
 * Two things go wrong in a payment summary, and they go wrong together. The AED
 * mark renders as a shape Tesseract has no letter for, so read in English it
 * becomes a digit stuck to the front: "36.00" comes back as "836.00". And in
 * the thin right-hand column the decimal point is simply lost: "4.90" comes
 * back as "490", or "5490" once the glyph is counted too.
 *
 * Neither is fixed by guessing. A receipt states its own arithmetic - the parts
 * add up to the total - so every reading of every field is tried against it,
 * and one is accepted only if it reconciles and no other reading does. Where
 * nothing reconciles, or two answers do, everything is left exactly as read and
 * a fee nobody could place stays off the screen rather than becoming AED 5,490.
 *
 * Returns the paths it changed, so they can be flagged for a human to check.
 */
function repairMergedCurrency(
  basket: StructuredBasket,
  lostDecimals: Partial<Record<MoneyField, string>>,
): string[] {
  const total = Number(basket.final_total);
  if (!Number.isFinite(total) || total <= 0) return [];

  const asRead = Object.fromEntries(
    MONEY_FIELDS.map((field) => [field, basket[field]]),
  ) as Record<MoneyField, string>;

  // Nothing was read and nothing was set aside: there is nothing to reconcile.
  const anything = MONEY_FIELDS.some(
    (field) => asRead[field] !== "" || lostDecimals[field] !== undefined,
  );
  if (!anything) return [];

  const value = (money: string) => (money === "" ? 0 : Number(money));
  const sum = (values: Record<MoneyField, string>) =>
    value(values.subtotal) + value(values.delivery_fee) + value(values.service_fee) -
    value(values.discount);

  // Already consistent: nothing to repair, and nothing to risk.
  if (Math.abs(sum(asRead) - total) < 0.02) return [];

  const readings = MONEY_FIELDS.map((field) => readingsOf(asRead[field], lostDecimals[field]));
  const reconciling: Array<{ values: Record<MoneyField, string>; changed: MoneyField[] }> = [];
  // Two paths can land on the same set of figures - one field left absent reads
  // the same as that field read as zero. Counting it twice would make a single
  // answer look like an ambiguous one.
  const seen = new Set<string>();

  const walk = (index: number, values: Record<MoneyField, string>) => {
    if (index === MONEY_FIELDS.length) {
      const signature = MONEY_FIELDS.map((field) => value(values[field]).toFixed(2)).join("|");
      if (seen.has(signature)) return;
      seen.add(signature);

      if (Math.abs(sum(values) - total) >= 0.02) return;
      const changed = MONEY_FIELDS.filter(
        (field) => value(values[field]) !== value(asRead[field]),
      );
      if (changed.length > 0) reconciling.push({ values: { ...values }, changed });
      return;
    }

    for (const option of readings[index]) {
      walk(index + 1, { ...values, [MONEY_FIELDS[index]]: option });
    }
  };
  walk(0, { ...asRead });

  // Exactly one answer, or none. Two would mean guessing.
  if (reconciling.length !== 1) return [];

  const [{ values, changed }] = reconciling;
  for (const field of changed) basket[field] = value(values[field]).toFixed(2);
  return changed;
}

/**
 * When a price line shows two amounts, the one you pay is the lower.
 *
 * Delivery apps print "28.00 35.00" - the discounted price beside the original
 * with a line through it. The strike-through does not survive OCR, so position
 * is no guide, but the discount always is: an offer never raises the price.
 */
function cheapestOf(line: string, fallback: string): string {
  const prices = allPrices(line);
  if (prices.length < 2) return fallback;
  return prices.reduce((low, price) => (Number(price) < Number(low) ? price : low));
}

/** "836.00" -> "36.00". Null when there is no leading digit to spare. */
function stripLeadingDigit(value: string): string | null {
  const match = value.match(/^\d(\d+(?:\.\d{1,2})?)$/);
  return match ? match[1] : null;
}

/**
 * The run of digits at the end of a fee line whose decimal point is gone.
 *
 * A payment summary prints its fees in a thin right-hand column, and the point
 * is the first thing to be lost there: "Delivery fee 4.90" comes back as
 * "5490", the glyph read as a 5 and the point missing entirely. Nothing on the
 * line can say where the point belongs, so this only collects the digits -
 * placing them is left to arithmetic.
 */
function bareDigitRun(line: string): string | null {
  const match = line.match(/(\d{3,6})\s*$/);
  return match ? match[1] : null;
}

/** "490" -> "4.90". Null when the run is too short to place a point in. */
function withLostDecimal(digits: string | null): string | null {
  if (digits === null || !/^\d{3,6}$/.test(digits)) return null;
  return (Number(digits) / 100).toFixed(2);
}

/**
 * Every reading of one field worth trying, most trusted first.
 *
 * A field read cleanly offers itself, and itself without its leading digit if
 * it has one to spare. A field that arrived as a run of digits offers the two
 * places its point could go back - and offers to stay absent, because digits
 * nobody can place are worth less than a blank row.
 */
function readingsOf(read: string, lost: string | undefined): string[] {
  if (read !== "") {
    const stripped = stripLeadingDigit(read);
    return stripped === null ? [read] : [read, stripped];
  }

  const placed = [withLostDecimal(lost ?? null), withLostDecimal(stripLeadingDigit(lost ?? ""))];
  return ["", ...placed.filter((option): option is string => option !== null)];
}

const MONEY_FIELDS = ["subtotal", "delivery_fee", "service_fee", "discount"] as const;
type MoneyField = (typeof MONEY_FIELDS)[number];

export interface ParseResult {
  basket: StructuredBasket;
  /** True when nothing recognisable came out, so the caller can stay quiet. */
  empty: boolean;
}

export function parseOcrText(raw: string): ParseResult {
  const basket = emptyBasket();
  const uncertain = new Set<string>();
  /** Fee amounts that arrived as digits with no point, held until proven. */
  const lostDecimals: Partial<Record<MoneyField, string>> = {};

  // Blank lines are KEPT. They are the only signal separating an item from its
  // own description: a delivery app prints the name, the contents, the price as
  // one block, then a gap before the next item. Discarding them means every
  // description after a priced item looks like a new item.
  // Raw and collapsed forms are both kept: the collapsed one is what gets read,
  // the raw one still carries the column spacing that identifies a card shelf.
  const lines = westernise(raw)
    .split(/\r?\n/)
    .map((rawLine) => ({ raw: rawLine, text: rawLine.replace(/\s+/g, " ").trim() }));

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
  /** A gap before this line means a new row started; no gap means it continues. */
  let afterGap = true;

  /**
   * A row that carries no price, no description and no word long enough to be
   * one is the engine reading the dish photograph, not the dish.
   *
   * Enlarging the screenshot is what makes this necessary: more pixels in the
   * photo means more spurious glyphs out of it, arriving as short standalone
   * lines - "Px Ta", "b( Ai". Every real item name across the screenshots
   * collected so far has a word of four letters in it, and any row that really
   * is an item has a price or an option list to say so.
   */
  const isPhotographNoise = (item: StructuredItem) =>
    item.line_total === "" && item.modifiers.length === 0 && longestWord(item.name) < 4;

  const flush = () => {
    if (pending && letterCount(pending.name) >= 2 && !isPhotographNoise(pending)) {
      pending.name = tidy(pending.name);
      // A description is words. Anything without one is the engine reading a
      // photograph, and the customer should not have to delete it.
      pending.modifiers = pending.modifiers.map(tidy).filter((entry) => longestWord(entry) >= 3);
      items.push(pending);
    }
    pending = null;
  };

  for (const [index, entry] of lines.entries()) {
    const original = entry.text;

    // The phone's own clock and battery, only ever the first line.
    if (index === 0 && looksLikeStatusBar(original)) continue;

    // A gap ends whatever row we were assembling.
    if (original === "") {
      flush();
      afterGap = true;
      continue;
    }

    const line = withoutJunkTail(entry.raw).replace(/\s+/g, " ").replace(NAV_GLYPHS, "").trim();
    const startsNewRow = afterGap;
    afterGap = false;

    if (line === "") continue;
    const lower = line.toLowerCase();

    const key = financialKey(lower);
    const priced = extractPrice(line);
    const isFree = /\bfree\b|مجان/.test(lower) && key !== "final_total";

    // An offer, not a fee. Checked before the fee rules because it satisfies
    // every one of them: a fee word, a price, and the word free.
    if (matches(lower, OFFER_CONDITIONS)) {
      flush();
      continue;
    }

    // ---- fees, subtotal, total --------------------------------------------
    // Checked before the banner filter: "Congrats! Your delivery is FREE" is
    // both a marketing banner and the delivery fee, and the fee has to win.
    if (key && (priced || isFree)) {
      flush();
      if (matches(lower, VAT_WORDS) && key !== "final_total") continue;
      // "Free delivery" with the old price struck through beside it is zero,
      // not 2.90 - and often the struck price does not survive OCR at all.
      const value = isFree ? "0.00" : (priced as { price: string }).price;
      if (key === "final_total" || basket[key] === "") basket[key] = value;
      continue;
    }

    // ---- a fee whose decimal point did not survive ------------------------
    // "Delivery fee 5490" is 4.90 read through the currency glyph, but nothing
    // on the line says so. The digits are set aside and shown only if the
    // receipt's own arithmetic later picks them out; otherwise the row simply
    // does not appear, which is better than charging the customer 5,490.
    if (key && key !== "final_total" && !priced && !isFree && basket[key] === "") {
      const digits = bareDigitRun(line);
      if (digits !== null && lostDecimals[key] === undefined) {
        flush();
        lostDecimals[key] = digits;
        continue;
      }
    }

    // Marketing banners carry money and read like items. Never food.
    if (matches(lower, PROMO)) {
      flush();
      continue;
    }

    if (matches(lower, ITEM_SECTION_ENDS)) {
      flush();
      itemsClosed = true;
      continue;
    }

    // Chrome, matched only on short lines so a dish called "Edit-style Wrap"
    // survives.
    if (line.length <= 24 && matches(lower, NOISE)) continue;

    if (key) continue;

    if (itemsClosed) continue;

    // A shelf of cards, whether or not its heading survived the screenshot.
    // Skipped, not flushed: OCR junk beside a description can widen its gaps
    // enough to look like columns, and closing the row there would strand the
    // item's price, which is still several lines below.
    if (countPrices(line) >= 3 || looksLikeCardRow(entry.raw)) continue;

    // Quantity steppers and stray glyphs: too few letters to be a name.
    if (letterCount(line) < 3) {
      // Unless it is nothing but a price, which belongs to the item above.
      if (priced && pending && pending.line_total === "" && letterCount(priced.rest) < 3) {
        pending.line_total = cheapestOf(line, priced.price);
      }
      continue;
    }

    // ---- a price printed beside a description line ------------------------
    // Some apps put the price level with the item's description rather than its
    // name, and OCR then reports them as one line. With no gap since the item
    // opened, this is still that item's row - not a second item.
    if (priced && pending !== null && pending.line_total === "" && !startsNewRow) {
      pending.line_total = priced.price;
      if (longestWord(priced.rest) >= 3 && pending.modifiers.length < 4) {
        pending.modifiers.push(priced.rest);
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
      if (pending && pending.line_total === "") pending.line_total = cheapestOf(line, priced.price);
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

    // A name cut in half by a narrow column is finished, not annotated - but a
    // continuation is a fragment ("Veg)"), not a sentence. Without the length
    // cap an unclosed bracket swallows the option list that follows it.
    if (pending.modifiers.length === 0 && line.length <= 20 && awaitsContinuation(pending.name)) {
      pending.name = `${pending.name} ${line}`.replace(/\s+/g, " ").trim();
      continue;
    }

    // Description lines under an item are its options.
    if (line.length <= 90 && pending.modifiers.length < 4) pending.modifiers.push(line);
  }

  flush();

  basket.items = items;
  for (const field of repairMergedCurrency(basket, lostDecimals)) uncertain.add(field);

  // Flag what there is evidence against, not everything. Marking every price
  // uncertain is the same as marking none: the customer stops looking.
  const total = Number(basket.final_total);
  if (Number.isFinite(total) && total > 0) {
    items.forEach((item, index) => {
      const price = Number(item.line_total);
      // A single line costing more than the whole order is impossible.
      if (Number.isFinite(price) && price > total) uncertain.add(`items[${index}].line_total`);
    });
  }
  if (basket.final_total === "") uncertain.add("final_total");
  items.forEach((item, index) => {
    const repaired = withoutGlyphDigit(item.line_total);
    if (repaired !== null) item.line_total = repaired;

    if (item.line_total === "") uncertain.add(`items[${index}].line_total`);
    if (repaired !== null || Number(item.line_total) > IMPLAUSIBLE_ITEM_PRICE) {
      uncertain.add(`items[${index}].line_total`);
    }
  });

  basket.uncertain_fields = [...uncertain];

  return {
    basket,
    // Empty means nothing recognisable came out, and a stated total is not the
    // only recognisable thing. A payment summary whose total lost its decimal
    // point still read a subtotal and two fees; binning all of it because one
    // line failed threw away the only screen that knows what the order cost.
    empty:
      items.length === 0 &&
      basket.restaurant_name === "" &&
      MONEY_FIELDS.every((field) => basket[field] === "") &&
      basket.final_total === "",
  };
}
