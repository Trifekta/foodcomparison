"use client";

/**
 * The last order this browser sent us.
 *
 * Remembered so a customer who comes back to the site - rather than tapping the
 * link we messaged them - is not asked to type anything. It is the same
 * capability they already hold in that link, kept on their own device and
 * nowhere else; nothing here is sent to us or readable by anyone but them.
 *
 * Storage can be unavailable or full (a private window, a browser set to block
 * site data), so every call is wrapped. Forgetting an order is a small loss -
 * the link in their message still works - and never worth an error.
 */

const KEY = "findfoodae.last-order";

/** Old enough that it is no longer "your last order" in any useful sense. */
const KEEP_FOR_MS = 7 * 24 * 60 * 60 * 1000;

interface LastOrder {
  reference: string;
  path: string;
  at: number;
}

export function rememberLastOrder(reference: string, path: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ reference, path, at: Date.now() } satisfies LastOrder));
  } catch {
    // A customer who cannot be remembered simply gets the screen as it was.
  }
}

export function readLastOrder(): LastOrder | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<LastOrder>;
    if (typeof parsed.path !== "string" || typeof parsed.reference !== "string") return null;
    if (typeof parsed.at !== "number" || Date.now() - parsed.at > KEEP_FOR_MS) {
      forgetLastOrder();
      return null;
    }
    // Only ever a path on this site: whatever is in storage, we navigate to
    // nothing that did not come from us.
    if (!parsed.path.startsWith("/r/")) return null;

    return { reference: parsed.reference, path: parsed.path, at: parsed.at };
  } catch {
    return null;
  }
}

export function forgetLastOrder(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to do: it expires on its own.
  }
}
