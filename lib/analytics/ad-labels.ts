/**
 * Turning what an advert stored into something a person can read.
 *
 * Meta's URL builder offers two kinds of macro for the same field. `{{ad.id}}`
 * writes 120249042878960301; `{{ad.name}}` writes "Same Order Different Price".
 * The adverts running today use the first kind, so every campaign and creative
 * column in the admin reads as an eighteen-digit number, and comparing two
 * creatives means holding two of those numbers side by side and matching them
 * against Ads Manager by eye.
 *
 * This resolves a stored value to a label without touching what is stored. The
 * raw value stays on the row, stays in the export, and stays the thing every
 * query groups by - an id is a stable key and a name is not, so the key is not
 * the part to change.
 *
 * Four ways a value can become a label, in the order they are tried:
 *
 *   override  what an admin typed on /admin/ad-labels. Wins over everything,
 *             because it is the one source that can be corrected without a
 *             deploy - and the one that can name an advert created this
 *             morning.
 *   builtin   shipped below. Sources mostly ("instagram" is not a name anybody
 *             chose, it is a value Meta writes), plus the ids that were already
 *             running when this was built, so the admin reads correctly before
 *             the migration is applied rather than after.
 *   slug      a readable value that was never an id: validation_week1 is
 *             already a name, it is just wearing underscores. Prettified, not
 *             looked up, so a campaign nobody has registered still reads.
 *   id        a bare number nothing knows. Shortened to its last six digits so
 *             that two unlabelled creatives are still visibly two, and marked
 *             as unlabelled so the admin can see there is something to name.
 *
 * Nothing here is customer-facing and nothing here identifies anybody: these
 * are the labels we put on our own adverts.
 */

export type AdLabelKind = "source" | "campaign" | "creative";

export interface AdLabelEntry {
  kind: AdLabelKind;
  /** The value as stored on the row: a Meta id, or a utm slug. */
  value: string;
  label: string;
}

/**
 * How a label was arrived at.
 *
 * The UI reads this rather than guessing from the strings: "id" is what earns
 * the unlabelled treatment and the prompt to name it, and "override" is the
 * only one that means a human chose these words.
 */
export type AdLabelOrigin = "override" | "builtin" | "slug" | "id" | "empty";

export interface ResolvedAdLabel {
  /** What to show. Never blank - an empty value resolves to a dash. */
  label: string;
  /**
   * The stored value, for the secondary line and the tooltip. Null when it
   * would only repeat the label, so a readable slug does not print twice.
   */
  raw: string | null;
  origin: AdLabelOrigin;
}

/**
 * Labels that ship with the code.
 *
 * Sources first, because those are not names anybody chose - Meta writes
 * "instagram" and "ig" into the same field depending on how the advert was
 * built, and both mean Instagram. Left alone they sort as two different
 * sources and split one campaign's numbers in half.
 *
 * The two campaign ids are the adverts that were running when this was
 * written. They are seeded into ad_labels as well, and an admin editing them
 * there overrides these - but a code default means the admin reads correctly
 * the moment this deploys, rather than only once somebody has applied a
 * migration and opened a form.
 */
export const BUILT_IN_AD_LABELS: readonly AdLabelEntry[] = [
  { kind: "source", value: "instagram", label: "Instagram" },
  { kind: "source", value: "ig", label: "Instagram" },
  { kind: "source", value: "facebook", label: "Facebook" },
  { kind: "source", value: "fb", label: "Facebook" },
  { kind: "source", value: "meta", label: "Meta" },
  { kind: "source", value: "whatsapp", label: "WhatsApp" },
  { kind: "source", value: "tiktok", label: "TikTok" },
  { kind: "source", value: "google", label: "Google" },
  { kind: "source", value: "direct", label: "Direct" },

  { kind: "campaign", value: "120249042250420301", label: "SnipSavor Validation" },
  { kind: "creative", value: "120249042878960301", label: "Same Order Different Price" },
] as const;

/** Case-insensitive, so a value stored as "Instagram" finds "instagram". */
export function adLabelKey(kind: AdLabelKind, value: string): string {
  return `${kind}:${value.trim().toLowerCase()}`;
}

export type AdLabelIndex = ReadonlyMap<string, string>;

/**
 * Builds the lookup the resolver reads.
 *
 * Later entries win, which is what layers the admin's rows on top of the
 * built-ins: pass the built-ins first and the database rows second, and a
 * renamed campaign takes effect without touching this file.
 */
export function buildAdLabelIndex(...groups: readonly (readonly AdLabelEntry[])[]): AdLabelIndex {
  const index = new Map<string, string>();
  for (const group of groups) {
    for (const entry of group) {
      const label = entry.label.trim();
      if (!label) continue;
      index.set(adLabelKey(entry.kind, entry.value), label);
    }
  }
  return index;
}

/** An 18-digit Meta object id, or anything else that is only digits. */
function isBareId(value: string): boolean {
  return /^\d{6,}$/.test(value);
}

/**
 * A slug, made readable.
 *
 * Splits on the separators a utm value uses, then splits a trailing number off
 * the word it is stuck to - "week1" is two pieces of information wearing one
 * token, and "Validation Week 1" is what somebody meant by it.
 */
function prettifySlug(value: string): string {
  return value
    .split(/[-_.+\s]+/)
    .filter(Boolean)
    .map((token) => token.replace(/([a-z])(\d)/gi, "$1 $2"))
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

/**
 * What to show for one stored value.
 *
 * `raw` is null whenever it would only repeat what `label` already says, so
 * the caller can print it unconditionally and a readable campaign does not get
 * a second line saying the same thing in grey.
 */
export function resolveAdLabel(
  kind: AdLabelKind,
  value: string | null | undefined,
  index?: AdLabelIndex,
): ResolvedAdLabel {
  const raw = value?.trim() ?? "";
  if (!raw) return { label: "—", raw: null, origin: "empty" };

  const mapped = index?.get(adLabelKey(kind, raw));
  if (mapped) {
    return {
      label: mapped,
      raw,
      // The caller cannot tell an admin's word from a shipped default by
      // looking at the string, and the two mean different things on screen.
      origin: isBuiltIn(kind, raw, mapped) ? "builtin" : "override",
    };
  }

  if (isBareId(raw)) {
    return { label: `…${raw.slice(-6)}`, raw, origin: "id" };
  }

  const pretty = prettifySlug(raw);
  return { label: pretty, raw: pretty === raw ? null : raw, origin: "slug" };
}

const BUILT_IN_INDEX = buildAdLabelIndex(BUILT_IN_AD_LABELS);

function isBuiltIn(kind: AdLabelKind, value: string, label: string): boolean {
  return BUILT_IN_INDEX.get(adLabelKey(kind, value)) === label;
}

/** The built-ins alone, for a caller with no database rows to layer on. */
export const BUILT_IN_AD_LABEL_INDEX: AdLabelIndex = BUILT_IN_INDEX;
