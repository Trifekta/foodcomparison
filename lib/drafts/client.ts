import { isWellFormedDraftToken } from "./token";
import type { DraftProgress } from "./progress";

/**
 * The browser's half of wizard drafts.
 *
 * Where the token lives, in the order it is looked for:
 *
 *   1. The URL fragment, #resume=<token>. A reload - including the discard and
 *      rebuild a phone does to a backgrounded tab - reloads the same URL, so
 *      this survives without any storage API. Fragments are never sent to a
 *      server, never appear in a Referer, and never reach a request log.
 *   2. sessionStorage, for a same-tab visit to /compare that arrived without
 *      the fragment.
 *   3. An HttpOnly cookie the server set, which the page cannot read; a
 *      readable hint cookie says whether asking for it is worthwhile.
 *
 * Any one of the three is enough.
 */

export type DraftSlot = "cart" | "checkout";

const FRAGMENT_KEY = "resume";
const SESSION_KEY = "snipsavor.draft";
const HINT_COOKIE = "snipsavor_draft_hint";
const TOKEN_HEADER = "x-draft-token";
export const RESUME_TEST_PARAM = "resume_test";

export type ResumeMode = "off" | "test" | "on";

/** Whether this page load uses drafts at all. */
export function isResumeActive(mode: ResumeMode, search: string): boolean {
  if (mode === "on") return true;
  if (mode !== "test") return false;
  return new URLSearchParams(search).get(RESUME_TEST_PARAM) === "1";
}

export function tokenFromFragment(hash: string): string | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const token = params.get(FRAGMENT_KEY);
  return isWellFormedDraftToken(token) ? token : null;
}

/** The same URL with the token written into (or removed from) its fragment. */
export function withFragmentToken(href: string, token: string | null): string {
  const url = new URL(href);
  const params = new URLSearchParams(url.hash.replace(/^#/, ""));
  if (token) params.set(FRAGMENT_KEY, token);
  else params.delete(FRAGMENT_KEY);
  const fragment = params.toString();
  url.hash = fragment ? `#${fragment}` : "";
  return url.toString();
}

function readSession(): string | null {
  try {
    const value = sessionStorage.getItem(SESSION_KEY);
    return isWellFormedDraftToken(value) ? value : null;
  } catch {
    return null;
  }
}

export function knownDraftToken(): string | null {
  return tokenFromFragment(window.location.hash) ?? readSession();
}

export function hasDraftHint(): boolean {
  return document.cookie.split(";").some((part) => part.trim().startsWith(`${HINT_COOKIE}=1`));
}

/**
 * Written into the URL with replaceState, which the App Router supports and
 * which leaves the history entry and Next's own state where they were.
 */
export function rememberDraftToken(token: string): void {
  const next = withFragmentToken(window.location.href, token);
  if (next !== window.location.href) window.history.replaceState(window.history.state, "", next);
  try {
    sessionStorage.setItem(SESSION_KEY, token);
  } catch {
    // The fragment and the cookie still hold it.
  }
}

export function forgetDraftToken(): void {
  const next = withFragmentToken(window.location.href, null);
  if (next !== window.location.href) window.history.replaceState(window.history.state, "", next);
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Nothing to do.
  }
}

function headers(token: string | null, extra: Record<string, string> = {}): Record<string, string> {
  return token ? { ...extra, [TOKEN_HEADER]: token } : extra;
}

export async function createDraft(progress: DraftProgress): Promise<string | null> {
  try {
    const response = await fetch("/api/drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(progress),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { token?: unknown };
    return isWellFormedDraftToken(payload.token) ? payload.token : null;
  } catch {
    return null;
  }
}

export interface FetchedDraft {
  token: string;
  progress: DraftProgress | null;
  images: Record<DraftSlot, boolean>;
}

/** Null token asks by cookie. "gone" means the server has no such draft. */
export async function fetchDraft(
  token: string | null,
  signal?: AbortSignal,
): Promise<FetchedDraft | "gone" | null> {
  try {
    const response = await fetch("/api/drafts", { headers: headers(token), signal, cache: "no-store" });
    if (response.status === 404) return "gone";
    if (!response.ok) return null;
    const payload = (await response.json()) as Partial<FetchedDraft>;
    if (!isWellFormedDraftToken(payload.token)) return null;
    return {
      token: payload.token,
      progress: payload.progress ?? null,
      images: { cart: Boolean(payload.images?.cart), checkout: Boolean(payload.images?.checkout) },
    };
  } catch {
    return null;
  }
}

export async function fetchDraftImage(
  token: string,
  slot: DraftSlot,
  signal?: AbortSignal,
): Promise<File | null> {
  try {
    const response = await fetch(`/api/drafts/image?slot=${slot}`, {
      headers: headers(token),
      signal,
      cache: "no-store",
    });
    if (!response.ok) return null;
    const blob = await response.blob();
    const type = blob.type || "image/jpeg";
    const extension = type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
    return new File([blob], `${slot}.${extension}`, { type });
  } catch {
    return null;
  }
}

export async function saveDraftProgress(
  token: string,
  progress: DraftProgress,
  keepalive = false,
): Promise<boolean> {
  try {
    const response = await fetch("/api/drafts", {
      method: "PUT",
      headers: headers(token, { "Content-Type": "application/json" }),
      body: JSON.stringify(progress),
      keepalive,
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function uploadDraftImage(token: string, slot: DraftSlot, file: File): Promise<boolean> {
  try {
    const body = new FormData();
    body.append("image", file);
    const response = await fetch(`/api/drafts/image?slot=${slot}`, {
      method: "PUT",
      headers: headers(token),
      body,
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function removeDraftImage(token: string, slot: DraftSlot): Promise<void> {
  try {
    await fetch(`/api/drafts/image?slot=${slot}`, { method: "DELETE", headers: headers(token) });
  } catch {
    // Pruned with the draft later if this never lands.
  }
}
