import { beforeEach, describe, expect, it } from "vitest";
import {
  checkRateLimit,
  clientKeyFromHeaders,
  resetRateLimits,
} from "@/lib/utils/rate-limit";

beforeEach(() => resetRateLimits());

describe("checkRateLimit", () => {
  it("allows submissions up to the limit and then blocks", () => {
    for (let i = 0; i < 3; i += 1) {
      expect(checkRateLimit("1.2.3.4", 3, 60_000, 0).allowed).toBe(true);
    }

    const blocked = checkRateLimit("1.2.3.4", 3, 60_000, 0);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(60);
  });

  it("keeps separate counters per client", () => {
    checkRateLimit("1.1.1.1", 1, 60_000, 0);
    expect(checkRateLimit("1.1.1.1", 1, 60_000, 0).allowed).toBe(false);
    expect(checkRateLimit("2.2.2.2", 1, 60_000, 0).allowed).toBe(true);
  });

  it("lets the client through again once the window passes", () => {
    checkRateLimit("1.2.3.4", 1, 60_000, 0);
    expect(checkRateLimit("1.2.3.4", 1, 60_000, 30_000).allowed).toBe(false);
    expect(checkRateLimit("1.2.3.4", 1, 60_000, 61_000).allowed).toBe(true);
  });
});

describe("clientKeyFromHeaders", () => {
  it("uses the first hop of x-forwarded-for", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.5, 70.41.3.18" });
    expect(clientKeyFromHeaders(headers)).toBe("203.0.113.5");
  });

  it("falls back to x-real-ip, then to a shared bucket", () => {
    expect(clientKeyFromHeaders(new Headers({ "x-real-ip": "203.0.113.9" }))).toBe("203.0.113.9");
    expect(clientKeyFromHeaders(new Headers())).toBe("unknown");
  });
});
