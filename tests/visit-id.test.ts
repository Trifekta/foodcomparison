import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * One page view, one visit id.
 *
 * The failure this file exists for: an in-app browser that accepts setItem and
 * then returns null from the very next getItem. visitId() read storage on
 * every call, so each track() on the page minted a fresh id and one person
 * arrived in the data as four, their events split between ids seconds apart.
 * Every funnel percentage divides by a count of distinct visit ids, so the
 * denominators moved with it.
 */

/** Storage that keeps what it is given, the way a browser is supposed to. */
function workingStorage() {
  const held = new Map<string, string>();
  return {
    getItem: (key: string) => held.get(key) ?? null,
    setItem: (key: string, value: string) => void held.set(key, value),
    removeItem: (key: string) => void held.delete(key),
    clear: () => held.clear(),
    key: () => null,
    length: 0,
  } as unknown as Storage;
}

/** Storage that takes a write, says nothing, and keeps none of it. */
function amnesiacStorage() {
  return {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
    key: () => null,
    length: 0,
  } as unknown as Storage;
}

/** Storage switched off hard, the way private mode used to behave. */
function throwingStorage() {
  return {
    getItem: () => {
      throw new Error("storage disabled");
    },
    setItem: () => {
      throw new Error("storage disabled");
    },
    removeItem: () => {},
    clear: () => {},
    key: () => null,
    length: 0,
  } as unknown as Storage;
}

/**
 * A fresh module instance, which is what a new page load is. The id is
 * memoised in module scope, so resetting modules is the only honest way to
 * ask "what would the next page view do".
 */
async function loadPage(storage: Storage) {
  vi.resetModules();
  vi.stubGlobal("localStorage", storage);
  const { visitId } = await import("@/lib/analytics/track");
  return visitId;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("visitId", () => {
  it("gives one id to every event in a page view when storage works", async () => {
    const visitId = await loadPage(workingStorage());
    const ids = [visitId(), visitId(), visitId(), visitId()];

    expect(new Set(ids).size).toBe(1);
    expect(ids[0]).toMatch(/^[0-9a-f]{16}$/);
  });

  it("still gives one id when storage accepts writes and keeps nothing", async () => {
    const visitId = await loadPage(amnesiacStorage());
    const ids = [visitId(), visitId(), visitId(), visitId()];

    expect(new Set(ids).size).toBe(1);
  });

  it("still gives one id when storage throws outright", async () => {
    const visitId = await loadPage(throwingStorage());
    const ids = [visitId(), visitId(), visitId()];

    expect(new Set(ids).size).toBe(1);
    // It used to return null here, so a visit in private mode recorded nothing
    // at all rather than recording itself once.
    expect(ids[0]).toMatch(/^[0-9a-f]{16}$/);
  });

  it("carries one id across page loads when storage works", async () => {
    const shared = workingStorage();

    const first = await loadPage(shared);
    const before = first();

    const second = await loadPage(shared);
    const after = second();

    expect(after).toBe(before);
  });

  /**
   * The limit of the memo, stated as a test so nobody reads more into it than
   * it does. A browser that keeps nothing gets a new id per page load, and no
   * amount of module state can fix that from inside the page - which is what
   * groupVisitors is for.
   */
  it("cannot carry an id across page loads when storage keeps nothing", async () => {
    const first = await loadPage(amnesiacStorage());
    const before = first();

    const second = await loadPage(amnesiacStorage());
    const after = second();

    expect(after).not.toBe(before);
  });
});
