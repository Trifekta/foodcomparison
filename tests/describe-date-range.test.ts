import { describe, expect, it } from "vitest";
import { describeDateRange } from "@/lib/admin/queries";

describe("describeDateRange", () => {
  it("says Last 30 days only when nothing was picked - the query's real default", () => {
    expect(describeDateRange({})).toBe("Last 30 days");
  });

  it("names a single day once, not as a from-to pair", () => {
    expect(describeDateRange({ from: "2026-09-19", to: "2026-09-19" })).toBe("19 Sep 2026");
  });

  it("spells out a full range", () => {
    expect(describeDateRange({ from: "2026-09-01", to: "2026-09-19" })).toBe(
      "1 Sep 2026 – 19 Sep 2026",
    );
  });

  it("handles an open-ended range either direction", () => {
    expect(describeDateRange({ from: "2026-09-01" })).toBe("Since 1 Sep 2026");
    expect(describeDateRange({ to: "2026-09-19" })).toBe("Until 19 Sep 2026");
  });

  it("never lets a UTC parse shift the day", () => {
    // The 1st and the 31st are the two dates a naive `new Date(iso)` parse -
    // interpreted as UTC midnight - is most likely to roll backwards a day
    // once formatted in Dubai's UTC+4.
    expect(describeDateRange({ from: "2026-09-01", to: "2026-09-01" })).toBe("1 Sep 2026");
    expect(describeDateRange({ from: "2026-08-31", to: "2026-08-31" })).toBe("31 Aug 2026");
  });
});
