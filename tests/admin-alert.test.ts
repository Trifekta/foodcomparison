import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The alert that makes the product work.
 *
 * Two things matter here and they pull against each other: it has to carry
 * enough for the admin to decide whether to get up, and it goes to a third
 * party - Telegram, since email was removed - so it must carry nothing about
 * the customer. And it must never be able
 * to cost somebody their submission.
 */

const sentTelegram: string[] = [];
let telegramConfigured = true;
let telegramThrows = false;

vi.mock("@/lib/env", () => ({
  absoluteUrl: (path: string) => `https://snipsavor.example${path}`,
}));

vi.mock("@/lib/notifications/telegram", () => ({
  isTelegramConfigured: () => telegramConfigured,
  sendTelegramMessage: async (text: string) => {
    if (telegramThrows) throw new Error("network");
    sentTelegram.push(text);
    return true;
  },
}));

const { alertAdminOfNewSubmission } = await import("@/lib/notifications/admin-alert");

const ALERT = {
  reference: "T829B3",
  restaurantName: "On The Wood",
  areaName: "Dubai Marina",
  currentTotal: "90.90",
  hasCheckoutImage: true,
  itemCount: 1,
};

beforeEach(() => {
  sentTelegram.length = 0;
  telegramConfigured = true;
  telegramThrows = false;
});

describe("alertAdminOfNewSubmission", () => {
  it("says what the admin needs to decide whether to go and do it", async () => {
    await alertAdminOfNewSubmission(ALERT);
    const message = sentTelegram[0];

    expect(message).toContain("T829B3");
    expect(message).toContain("On The Wood");
    expect(message).toContain("Dubai Marina");
    expect(message).toContain("90.90");
    expect(message).toContain("cart + checkout");
    expect(message).toContain("https://snipsavor.example/admin");
  });

  it("carries nothing about the customer to a third party", async () => {
    await alertAdminOfNewSubmission(ALERT);
    const everything = sentTelegram.join(" ");

    for (const secret of ["+9715", "@example.com", "whatsapp", "cart.png"]) {
      expect(everything.toLowerCase()).not.toContain(secret.toLowerCase());
    }
  });

  it("sends by Telegram when it is configured", async () => {
    await alertAdminOfNewSubmission(ALERT);
    expect(sentTelegram).toHaveLength(1);
  });

  it("does nothing at all when nothing is configured", async () => {
    telegramConfigured = false;
    await expect(alertAdminOfNewSubmission(ALERT)).resolves.toBeUndefined();
    expect(sentTelegram).toHaveLength(0);
  });

  it("does not throw when a channel fails", async () => {
    // The submission is already written by the time this runs. A failed alert
    // is a slower answer; a thrown error would be a lost customer.
    telegramThrows = true;
    await expect(alertAdminOfNewSubmission(ALERT)).resolves.toBeUndefined();
  });

  it("says so plainly when the customer gave less", async () => {
    await alertAdminOfNewSubmission({
      ...ALERT,
      restaurantName: null,
      areaName: null,
      hasCheckoutImage: false,
      itemCount: 0,
    });
    const message = sentTelegram[0];
    expect(message).toContain("not given");
    expect(message).toContain("cart only");
    expect(message).not.toContain("Items listed");
  });
});

describe("alertChannels and the test alert", () => {
  it("names what is configured, so the dashboard can say so", async () => {
    const { alertChannels } = await import("@/lib/notifications/admin-alert");
    expect(alertChannels()).toEqual(["Telegram"]);

    telegramConfigured = false;
    expect(alertChannels()).toEqual([]);
  });

  it("sends the test down the same path a real alert takes", async () => {
    // A test that exercised a different path would prove nothing.
    const { sendTestAdminAlert } = await import("@/lib/notifications/admin-alert");
    expect(await sendTestAdminAlert()).toBe(true);
    expect(sentTelegram[0]).toContain("Test alert");
  });

  it("reports failure rather than claiming success", async () => {
    const { sendTestAdminAlert } = await import("@/lib/notifications/admin-alert");
    telegramConfigured = false;
    expect(await sendTestAdminAlert()).toBe(false);
  });
});
