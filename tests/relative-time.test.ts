import { describe, expect, it } from "vitest";
import { formatRelativeTime } from "@/lib/utils/text";

const NOW = Date.parse("2026-09-18T12:00:00Z");
const secondsAgo = (seconds: number) => new Date(NOW - seconds * 1000).toISOString();

describe("formatRelativeTime", () => {
  it("reads as just now for anything under ten seconds", () => {
    expect(formatRelativeTime(secondsAgo(0), NOW)).toBe("just now");
    expect(formatRelativeTime(secondsAgo(9), NOW)).toBe("just now");
  });

  it("counts seconds up to a minute", () => {
    expect(formatRelativeTime(secondsAgo(10), NOW)).toBe("10s ago");
    expect(formatRelativeTime(secondsAgo(59), NOW)).toBe("59s ago");
  });

  it("counts minutes up to an hour", () => {
    expect(formatRelativeTime(secondsAgo(60), NOW)).toBe("1 min ago");
    expect(formatRelativeTime(secondsAgo(59 * 60), NOW)).toBe("59 min ago");
  });

  it("counts hours up to a day", () => {
    expect(formatRelativeTime(secondsAgo(60 * 60), NOW)).toBe("1h ago");
    expect(formatRelativeTime(secondsAgo(23 * 60 * 60), NOW)).toBe("23h ago");
  });

  it("counts days beyond that", () => {
    expect(formatRelativeTime(secondsAgo(24 * 60 * 60), NOW)).toBe("1d ago");
    expect(formatRelativeTime(secondsAgo(3 * 24 * 60 * 60), NOW)).toBe("3d ago");
  });

  it("never goes negative for a clock slightly ahead of the timestamp", () => {
    expect(formatRelativeTime(new Date(NOW + 2000), NOW)).toBe("just now");
  });
});
