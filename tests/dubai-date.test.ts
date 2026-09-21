import { describe, expect, it } from "vitest";
import { dubaiIsoDate, dubaiIsoDateDaysAgo } from "@/lib/utils/text";

/**
 * Every date filter in the dashboard is read as a Dubai calendar day by the
 * server. These are the helpers the "Today" buttons and the default range use
 * so they ask for the same day, whatever clock the admin's phone is on.
 */
describe("dubaiIsoDate", () => {
  it("names the Dubai day, not the UTC one", () => {
    // 9pm UTC is already the next morning in Dubai.
    expect(dubaiIsoDate("2026-09-20T21:00:00Z")).toBe("2026-09-21");
    expect(dubaiIsoDate("2026-09-20T19:59:59Z")).toBe("2026-09-20");
  });

  it("is unmoved by the machine's own timezone", () => {
    const midday = "2026-09-21T08:00:00Z";
    expect(dubaiIsoDate(midday)).toBe("2026-09-21");
    expect(dubaiIsoDate(new Date(midday))).toBe("2026-09-21");
    expect(dubaiIsoDate(Date.parse(midday))).toBe("2026-09-21");
  });

  it("pads a single-digit month and day", () => {
    expect(dubaiIsoDate("2026-01-05T08:00:00Z")).toBe("2026-01-05");
  });
});

describe("dubaiIsoDateDaysAgo", () => {
  it("steps back whole Dubai days", () => {
    expect(dubaiIsoDateDaysAgo(1, "2026-09-21T08:00:00Z")).toBe("2026-09-20");
    expect(dubaiIsoDateDaysAgo(6, "2026-09-21T08:00:00Z")).toBe("2026-09-15");
  });

  it("crosses a month and a year boundary", () => {
    expect(dubaiIsoDateDaysAgo(1, "2026-03-01T08:00:00Z")).toBe("2026-02-28");
    expect(dubaiIsoDateDaysAgo(1, "2026-01-01T08:00:00Z")).toBe("2025-12-31");
  });
});
