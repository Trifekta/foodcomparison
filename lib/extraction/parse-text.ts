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
 * It leans on one thing every delivery receipt does: a price sits on the same
 * line as whatever it is the price of. Everything else is keywords.
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

/** Lines that are chrome, not content. */
const NOISE = [
  "cart",
  "your order",
  "order summary",
  "checkout",
  "basket",
  "payment",
  "add items",
  "view menu",
  "السلة",
  "الطلب",
];

const VAT_WORDS = ["vat", "tax", "ضريبة"];

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

export interface ParseResult {
  basket: StructuredBasket;
  /** True when nothing recognisable came out, so the caller can stay quiet. */
  empty: boolean;
}

export function parseOcrText(raw: string): ParseResult {
  const basket = emptyBasket();
  const uncertain = new Set<string>();

  const lines = westernise(raw)
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0);

  const items: StructuredItem[] = [];
  let seenFinancial = false;

  for (const line of lines) {
    const lower = line.toLowerCase();

    if (NOISE.some((word) => lower === word || lower.startsWith(`${word} `))) continue;

    const priced = extractPrice(line);
    const key = financialKey(lower);

    // ---- a fee, a subtotal or the total -----------------------------------
    if (key && priced) {
      seenFinancial = true;
      // VAT lines mention tax, not a fee we track; skip rather than mislabel.
      if (matches(lower, VAT_WORDS) && key !== "final_total") continue;
      // The last "total" on a receipt is the one that counts, so it overwrites.
      // Every other figure keeps the first reading - a second "delivery" line is
      // usually a promotional strike-through, not a correction.
      if (key === "final_total" || basket[key] === "") basket[key] = priced.price;
      continue;
    }

    // A keyword line with no price tells us nothing; skip it.
    if (key) continue;

    // ---- an item ----------------------------------------------------------
    if (priced && priced.rest.length > 1) {
      const { quantity, name } = extractQuantity(priced.rest);
      if (name.length > 1) {
        items.push({ name, quantity, modifiers: [], unit_price: "", line_total: priced.price });
        continue;
      }
    }

    // ---- no price: a restaurant name, or options under the item above -----
    if (!priced) {
      // Two letters minimum, so a row of OCR garbage does not become the
      // restaurant and make an unreadable screenshot look like a good read.
      const looksLikeWords = (line.match(/\p{L}/gu) ?? []).length >= 2;

      if (looksLikeWords && basket.restaurant_name === "" && items.length === 0 && !seenFinancial) {
        basket.restaurant_name = line;
        // Rules cannot tell a restaurant from a section heading, so this is
        // always worth the customer's eye.
        uncertain.add("restaurant_name");
        continue;
      }

      const previous = items.at(-1);
      // Short trailing text under an item reads as its options.
      if (previous && line.length <= 80 && previous.modifiers.length < 6) {
        previous.modifiers.push(line);
      }
    }
  }

  basket.items = items;

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
