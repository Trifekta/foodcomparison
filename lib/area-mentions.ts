/**
 * Which areas the screenshot itself mentions.
 *
 * The customer tells us where the order is going; the screenshot was priced by
 * their own app at whatever address was set in it. Those are usually the same
 * place and occasionally are not - somebody at work ordering dinner home, or
 * ordering for family in another emirate - and when they differ the comparison
 * is run against the wrong location.
 *
 * That failure is quiet and expensive: the wrong area can put the restaurant
 * outside Keeta's range, which comes back as "not available", and we tell a
 * customer to stay where they are when Keeta might have been cheaper at their
 * real address.
 *
 * So this reports evidence, never a verdict. It says which area names appear in
 * the text and leaves the judgement to the admin looking at the screenshot,
 * because a mention is just as likely to be the restaurant's own location or a
 * dish named after a neighbourhood. A flag that cried wolf would be worth less
 * than nothing - it would be ignored, and then ignored on the day it was right.
 */

export interface MentionableArea {
  id: string;
  name: string;
  city: string;
}

export interface AreaMention {
  id: string;
  name: string;
  city: string;
}

/** Escapes a name so a stray character in it cannot become a pattern. */
function toWordBoundaryPattern(name: string): RegExp {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`, "iu");
}

/**
 * Area names appearing in OCR output, minus the one already selected.
 *
 * Matched on word boundaries rather than as bare substrings, so "Rolla" does
 * not fire on "Rollarama" and "JBR" does not fire inside a product code. The
 * boundaries are letter/number classes rather than \b, because \b treats a
 * hyphen as a boundary and "Dibba Al-Hisn" would otherwise match oddly.
 *
 * When two matched names overlap - "Al Nahda" sits inside "Al Nahda Dubai" -
 * only the longer survives, so one address does not get reported as two places.
 */
export function areasMentionedIn(
  ocrText: string | null | undefined,
  areas: MentionableArea[],
  selectedAreaId: string | null,
): AreaMention[] {
  const text = ocrText?.trim();
  if (!text) return [];

  const matched = areas.filter(
    (area) => area.id !== selectedAreaId && toWordBoundaryPattern(area.name).test(text),
  );

  const survivors = matched.filter(
    (area) =>
      !matched.some(
        (other) =>
          other !== area &&
          other.name.length > area.name.length &&
          toWordBoundaryPattern(area.name).test(other.name),
      ),
  );

  // De-duplicated by name: the same neighbourhood can exist in two cities, and
  // the admin only needs to be told about the place once.
  const seen = new Set<string>();
  return survivors
    .filter((area) => {
      const key = area.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((area) => ({ id: area.id, name: area.name, city: area.city }));
}
