import { describe, expect, it } from "vitest";
import { composeChase, minutesWaiting, type UnansweredRow } from "@/lib/notifications/chase";

/**
 * The message a reminder sends.
 *
 * The database half of the chaser is a query, and a query is better checked
 * against a database than against a mock. What is worth testing here is the
 * wording: it goes to a lock screen, so it must be right about how long
 * somebody has been waiting and must never name a customer.
 */

const NOW = new Date("2026-09-12T19:30:00.000Z").getTime();

function row(overrides: Partial<UnansweredRow> = {}): UnansweredRow {
  return {
    id: "0d2c6d5a-1a1a-4f4f-9a9a-2b2b2b2b2b2b",
    reference_number: "K7M2PQ",
    // Twelve minutes before NOW.
    created_at: "2026-09-12T19:18:00.000Z",
    areas: { name: "Al Karama" },
    ...overrides,
  };
}

describe("how long something has been waiting", () => {
  it("counts whole minutes", () => {
    expect(minutesWaiting("2026-09-12T19:18:00.000Z", NOW)).toBe(12);
    expect(minutesWaiting("2026-09-12T19:29:59.000Z", NOW)).toBe(0);
  });

  it("never goes negative on a clock that disagrees", () => {
    expect(minutesWaiting("2026-09-12T19:45:00.000Z", NOW)).toBe(0);
  });

  it("returns zero for an unparseable timestamp rather than NaN", () => {
    expect(minutesWaiting("not a date", NOW)).toBe(0);
  });
});

describe("what the reminder says", () => {
  it("names the area and the wait when one is waiting", () => {
    const { title, body } = composeChase([row()], NOW);
    expect(title).toContain("Still waiting");
    expect(body).toBe("A comparison from Al Karama has been waiting 12 minutes.");
  });

  it("drops the area when there isn't one", () => {
    const { body } = composeChase([row({ areas: null })], NOW);
    expect(body).toBe("A comparison has been waiting 12 minutes.");
  });

  /**
   * One notification however many are waiting. Three orders at once is one
   * thing to go and do, and three buzzes is how somebody learns to ignore the
   * buzzing.
   */
  it("summarises several, leading with the oldest wait", () => {
    const { body } = composeChase(
      [
        row({ id: "a", created_at: "2026-09-12T19:00:00.000Z" }),
        row({ id: "b", created_at: "2026-09-12T19:18:00.000Z" }),
        row({ id: "c", created_at: "2026-09-12T19:20:00.000Z" }),
      ],
      NOW,
    );
    expect(body).toBe("3 comparisons are unanswered — the oldest for 30 minutes.");
  });

  it("does not name an area once there is more than one waiting", () => {
    const { body } = composeChase([row({ id: "a" }), row({ id: "b" })], NOW);
    expect(body).not.toContain("Al Karama");
  });

  /**
   * It is rendered on a lock screen and passes through a push service, so the
   * reference, the total and anything about the customer stay out of it.
   */
  it("carries nothing that identifies a submission or a person", () => {
    const { title, body } = composeChase([row()], NOW);
    const text = `${title} ${body}`;
    expect(text).not.toContain("K7M2PQ");
    expect(text).not.toContain("0d2c6d5a");
    expect(text).not.toMatch(/AED|\+971|@/);
  });
});
