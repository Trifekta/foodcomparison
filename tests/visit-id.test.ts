import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { visitId } from "@/lib/analytics/track";
import { VISIT_ID_PATTERN } from "@/lib/analytics/funnel";

/**
 * How long one visit lasts.
 *
 * The id is one browser for one Dubai day. Both halves of that matter: it has
 * to survive the tab closing (the same person arriving from Instagram twice is
 * one visit), and it has to NOT survive midnight (an id that straddled the
 * boundary would put one visit's events in two of the dashboard's day windows,
 * which is the cross-day mixing the visits page exists to avoid).
 */

const KEY = "snipsavor.visit";

let store: Map<string, string>;

/** Just enough of the Storage interface for the three calls visitId() makes. */
function installStorage(throwOnAccess = false) {
  store = new Map();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get() {
      if (throwOnAccess) throw new Error("storage is off");
      return {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => void store.set(key, value),
        removeItem: (key: string) => void store.delete(key),
      };
    },
  });
}

/** 4pm in Dubai on the given day, as the instant the clock is set to. */
const dubaiAfternoon = (day: string) => new Date(`${day}T12:00:00Z`);

beforeEach(() => {
  vi.useFakeTimers();
  installStorage();
});

afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(globalThis, "localStorage");
});

describe("visitId", () => {
  it("makes one id and keeps handing back the same one", () => {
    vi.setSystemTime(dubaiAfternoon("2026-09-21"));

    const first = visitId();
    expect(first).toMatch(VISIT_ID_PATTERN);
    expect(visitId()).toBe(first);
    expect(visitId()).toBe(first);
  });

  it("stamps the id with the Dubai day it was made on", () => {
    // 9pm UTC is already the 21st in Dubai, and the stamp has to say so or the
    // id expires a day late for everyone browsing in the evening.
    vi.setSystemTime(new Date("2026-09-20T21:00:00Z"));

    const id = visitId();
    expect(JSON.parse(store.get(KEY)!)).toEqual({ id, day: "2026-09-21" });
  });

  it("survives the tab closing - the same browser later that day is one visit", () => {
    vi.setSystemTime(dubaiAfternoon("2026-09-21"));
    const morning = visitId();

    // Nothing is cleared: localStorage is what outlives a tab, which is the
    // whole reason this moved off sessionStorage.
    vi.setSystemTime(new Date("2026-09-21T18:00:00Z"));
    expect(visitId()).toBe(morning);
  });

  it("starts a new visit once the Dubai day turns over", () => {
    // 11:30pm Dubai, then half an hour later - the same 24-hour window, and
    // deliberately two different visits.
    vi.setSystemTime(new Date("2026-09-21T19:30:00Z"));
    const lastNight = visitId();

    vi.setSystemTime(new Date("2026-09-21T20:30:00Z"));
    const today = visitId();

    expect(today).not.toBe(lastNight);
    expect(today).toMatch(VISIT_ID_PATTERN);
    expect(JSON.parse(store.get(KEY)!).day).toBe("2026-09-22");
  });

  it("replaces an id left over from an earlier day", () => {
    store.set(KEY, JSON.stringify({ id: "a".repeat(16), day: "2026-09-14" }));
    vi.setSystemTime(dubaiAfternoon("2026-09-21"));

    expect(visitId()).not.toBe("a".repeat(16));
  });

  it("replaces whatever else ended up under the key, rather than going quiet", () => {
    vi.setSystemTime(dubaiAfternoon("2026-09-21"));

    for (const junk of ["not json at all", "null", '{"day":"2026-09-21"}', '{"id":"nope","day":"2026-09-21"}']) {
      store.set(KEY, junk);
      const id = visitId();
      expect(id).toMatch(VISIT_ID_PATTERN);
      // And the good value is what stays behind, so the next call is cheap.
      expect(visitId()).toBe(id);
    }
  });

  it("gives up quietly when storage is switched off", () => {
    installStorage(true);
    vi.setSystemTime(dubaiAfternoon("2026-09-21"));

    expect(visitId()).toBeNull();
  });
});
