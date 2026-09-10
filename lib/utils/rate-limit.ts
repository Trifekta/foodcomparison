import { RATE_LIMIT_MAX_SUBMISSIONS, RATE_LIMIT_WINDOW_MS } from "@/lib/constants";

/**
 * Best-effort in-memory rate limiting for the public submission endpoint.
 *
 * This is per-instance and resets on cold start, which is acceptable for the MVP:
 * it stops a single browser hammering the endpoint. If abuse becomes a real
 * problem, swap this module for a Postgres or Upstash-backed counter - the
 * interface stays the same.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export function checkRateLimit(
  key: string,
  max = RATE_LIMIT_MAX_SUBMISSIONS,
  windowMs = RATE_LIMIT_WINDOW_MS,
  now = Date.now(),
): RateLimitResult {
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    pruneExpired(now);
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (existing.count >= max) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000),
    };
  }

  existing.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

function pruneExpired(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/** Exposed for tests. */
export function resetRateLimits(): void {
  buckets.clear();
}

/** Derives a client key from proxy headers, falling back to a shared bucket. */
export function clientKeyFromHeaders(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "unknown";
}
