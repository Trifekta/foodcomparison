"use client";

/**
 * Where this customer came from, captured where it actually exists.
 *
 * Campaign parameters live on the first URL of a visit and nowhere else. By the
 * time somebody reaches the result page - let alone taps through to Keeta -
 * they are several client-side navigations away and the query string is long
 * gone. Reading them at the end is reading an empty string, which is how a
 * campaign report comes to say every customer arrived from nowhere.
 *
 * So they are taken on arrival, kept for the visit, attached to the submission,
 * and inherited by the switch. That is the whole chain:
 *
 *   Instagram ad -> landing -> screenshot sent -> result -> switched to Keeta
 *
 * First touch wins. A customer who lands from an advert, wanders to the privacy
 * page and comes back with a clean URL has not stopped being an advert click,
 * and letting the second arrival overwrite the first would quietly reassign
 * every paid visit to "direct".
 *
 * sessionStorage, exactly like the visit id: one tab, thrown away when it
 * closes, and belonging to nobody. Nothing here identifies a person - these are
 * the labels we put on our own adverts, plus the page they arrived on.
 */

const KEY = "snipsavor.attribution";

/** Longer than any sane campaign name, short enough that no column is at risk. */
const MAX_LENGTH = 160;

export interface Attribution {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  /**
   * The ad platform's own click identifier: fbclid from Meta, gclid from
   * Google, ttclid from TikTok. One column, because a visit only ever has one
   * and keeping three would mean three empty columns for every customer.
   */
  clickId: string | null;
  /** Which page the advert pointed at, so a landing test is answerable. */
  landingPath: string | null;
  /** Whatever sent them, when the browser says. Origin only - see below. */
  referrer: string | null;
}

const EMPTY: Attribution = {
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
  utmContent: null,
  utmTerm: null,
  clickId: null,
  landingPath: null,
  referrer: null,
};

function clean(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().slice(0, MAX_LENGTH);
  return trimmed || null;
}

/**
 * The referrer, reduced to where it came from.
 *
 * Only the origin is kept. A full referrer URL can carry a search query or a
 * path that says something about the person - "which Instagram post" is worth
 * having, "what they were reading" is not ours to store.
 */
function referrerOrigin(): string | null {
  try {
    if (!document.referrer) return null;
    const url = new URL(document.referrer);
    // Our own pages are not a referral. Without this every internal navigation
    // that happened to be the first one counts as a source.
    if (url.origin === window.location.origin) return null;
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Whether this visit carried any attribution at all.
 *
 * The landing path is excluded deliberately: every visit has one, so counting
 * it would make every visit look attributed - and would store a row of nulls on
 * the first arrival that then blocks a later one carrying a real campaign.
 * What makes a visit attributable is a campaign label, an ad click id, or
 * somebody else's site sending them.
 */
function isEmpty(value: Attribution): boolean {
  return (
    value.utmSource === null &&
    value.utmMedium === null &&
    value.utmCampaign === null &&
    value.utmContent === null &&
    value.utmTerm === null &&
    value.clickId === null &&
    value.referrer === null
  );
}

/**
 * Reads the current URL and remembers it, unless something is already stored.
 *
 * Safe to call from every entry point, and meant to be: an advert can point at
 * the landing page or straight at the wizard, and only the page that was
 * actually opened first can see the parameters.
 */
export function captureAttribution(): void {
  if (typeof window === "undefined") return;

  try {
    if (sessionStorage.getItem(KEY)) return;

    const params = new URLSearchParams(window.location.search);
    const captured: Attribution = {
      utmSource: clean(params.get("utm_source")),
      utmMedium: clean(params.get("utm_medium")),
      utmCampaign: clean(params.get("utm_campaign")),
      utmContent: clean(params.get("utm_content")),
      utmTerm: clean(params.get("utm_term")),
      clickId:
        clean(params.get("fbclid")) ??
        clean(params.get("gclid")) ??
        clean(params.get("ttclid")),
      landingPath: clean(window.location.pathname),
      referrer: referrerOrigin(),
    };

    // A visit with nothing on it is not worth a row of nulls, and storing one
    // would stop a later arrival that does carry a campaign from being seen.
    if (isEmpty(captured)) return;

    sessionStorage.setItem(KEY, JSON.stringify(captured));
  } catch {
    // Private mode, or storage switched off. Attribution stops; nothing else does.
  }
}

/** What was captured on arrival, for the submission to carry. */
export function currentAttribution(): Attribution {
  if (typeof window === "undefined") return EMPTY;

  try {
    const stored = sessionStorage.getItem(KEY);
    if (!stored) return EMPTY;
    const parsed = JSON.parse(stored) as Partial<Attribution>;
    return { ...EMPTY, ...parsed };
  } catch {
    return EMPTY;
  }
}

/**
 * The form fields the submission endpoint reads.
 *
 * Named in the wire format the database uses rather than in this file's camel
 * case, so the route, the schema and the column all read the same.
 */
export function attributionFormFields(value: Attribution): Record<string, string> {
  const fields: Record<string, string> = {};
  const add = (name: string, entry: string | null) => {
    if (entry) fields[name] = entry;
  };

  add("utmSource", value.utmSource);
  add("utmMedium", value.utmMedium);
  add("utmCampaign", value.utmCampaign);
  add("utmContent", value.utmContent);
  add("utmTerm", value.utmTerm);
  add("clickId", value.clickId);
  add("landingPath", value.landingPath);
  add("landingReferrer", value.referrer);

  return fields;
}
