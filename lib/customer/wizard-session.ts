import { WIZARD_DEFAULTS, type CartItemDraft, type WizardValues } from "@/components/customer/wizard/types";

/**
 * What the wizard remembers while somebody is off in another app.
 *
 * The problem this exists for: the flow asks people to leave. They open
 * Talabat, build a basket, screenshot it, come back - and on a phone that round
 * trip routinely costs the tab. A browser under memory pressure discards a
 * backgrounded page and reloads it on return, which takes React state with it.
 * Without this, somebody who had already typed a restaurant name and picked an
 * area comes back to an empty step one, and the screen that greets them says
 * "welcome back" on top of work they just lost.
 *
 * sessionStorage, not localStorage, because the lifetime wanted here is exactly
 * a tab's: it survives the reload and dies when the tab closes. It is also
 * where the visit id already lives (lib/analytics/track.ts), so a restored
 * wizard is still the same visit to the dashboard rather than a second one.
 *
 * Screenshots are NOT stored. A File is not serialisable, and the Blob behind
 * it would need IndexedDB to outlive the page - so a restore that lands after a
 * real eviction has the typed fields and no image, which is why restoredStep
 * below puts them back on the upload screen rather than somewhere that assumes
 * a screenshot exists.
 */

const SESSION_KEY = "snipsavor.wizard";
const AWAY_KEY = "snipsavor.away";

export interface SavedWizardSession {
  step: number;
  values: WizardValues;
  items: CartItemDraft[];
}

/**
 * Where a returning customer should land.
 *
 * Pure, and separate from the storage above, because it is the one rule here
 * with a decision in it. Anything at or past the basket screen assumes a
 * screenshot has been read; if the restore arrived without one - which is every
 * restore that followed an eviction - that assumption is false and the honest
 * place to put them is the screen that asks for it.
 */
export function restoredStep(savedStep: number, hasCartFile: boolean, uploadStep: number): number {
  if (!hasCartFile) return uploadStep;
  return savedStep > uploadStep ? savedStep : uploadStep;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Whether a restored session actually carries anything they typed.
 *
 * The welcome-back greeting offers to reassure people that their work
 * survived, and for the visit this whole flow is built around - an advert
 * click who taps straight through to Talabat from an empty step one - there is
 * no work yet, so the reassurance is about nothing. Promising the safety of
 * something the customer never entered reads as a system talking to itself.
 *
 * Compared against the defaults rather than emptiness, so a dial code nobody
 * chose does not count as progress.
 */
export function hasProgress(session: SavedWizardSession): boolean {
  if (session.items.length > 0) return true;
  return (Object.keys(WIZARD_DEFAULTS) as (keyof WizardValues)[]).some(
    (key) => session.values[key] !== WIZARD_DEFAULTS[key],
  );
}

/**
 * Reads back what was stored, or null.
 *
 * Shape-checked field by field rather than trusted. Nobody but this tab can
 * write this key, so the check is not a security boundary - it is about a
 * stored shape from a previous deploy meeting code that has moved on, where the
 * right answer is to start clean rather than to hand a half-populated object to
 * a form.
 */
export function loadWizardSession(): SavedWizardSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    if (typeof parsed.step !== "number" || !Number.isFinite(parsed.step)) return null;
    if (!isRecord(parsed.values)) return null;

    // Unknown keys dropped, missing keys defaulted: the stored object only
    // contributes the fields the wizard still has.
    const values = { ...WIZARD_DEFAULTS };
    for (const key of Object.keys(WIZARD_DEFAULTS) as (keyof WizardValues)[]) {
      const stored = parsed.values[key];
      if (typeof stored === typeof WIZARD_DEFAULTS[key]) {
        (values as Record<string, unknown>)[key] = stored;
      }
    }

    const items = Array.isArray(parsed.items)
      ? parsed.items.filter(
          (item): item is CartItemDraft =>
            isRecord(item) &&
            typeof item.key === "string" &&
            typeof item.name === "string" &&
            typeof item.quantity === "number",
        )
      : [];

    return { step: parsed.step, values, items };
  } catch {
    // Private mode, storage switched off, or unparseable. Start clean.
    return null;
  }
}

export function saveWizardSession(session: SavedWizardSession): void {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Quota or private mode. Losing the backup is survivable; throwing here,
    // on a keystroke, is not.
  }
}

export function clearWizardSession(): void {
  try {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(AWAY_KEY);
  } catch {
    // Nothing to do and nothing worth saying.
  }
}

/**
 * Armed by tapping a food-app link, and by nothing else.
 *
 * This used to be set from visibilitychange, which meant every tab switch, lock
 * screen and pulled-down notification shade counted as "went shopping" - so the
 * welcome-back greeted people who had never left, and would have yanked them
 * back to step one mid-wizard. Only a deliberate tap on one of the four links
 * sets it now.
 */
export function markLeavingForApp(): void {
  try {
    sessionStorage.setItem(AWAY_KEY, "1");
  } catch {
    // Without the flag they simply come back to where they were, which is the
    // behaviour this whole module is an improvement on, not a regression past.
  }
}

/** True once per departure: reading it disarms the flag. */
export function consumeReturnFromApp(): boolean {
  try {
    if (sessionStorage.getItem(AWAY_KEY) !== "1") return false;
    sessionStorage.removeItem(AWAY_KEY);
    return true;
  } catch {
    return false;
  }
}
