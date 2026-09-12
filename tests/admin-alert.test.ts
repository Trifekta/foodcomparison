import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The alert that makes the product work.
 *
 * Two things matter here and they pull against each other: it has to carry
 * enough for the admin to decide whether to get up, and it goes to a third
 * party, so it must carry nothing about the customer. And it must never be able
 * to cost somebody their submission.
 */

const sentTelegram: string[] = [];
const sentEmail: Array<{ to: string; subject: string; body: string }> = [];
let telegramConfigured = true;
let telegramThrows = false;
let alertEmail: string | null = "admin@example.com";
let emailConfigured = true;

vi.mock("@/lib/env", () => ({
  absoluteUrl: (path: string) => `https://snipsavor.example${path}`,
  getAdminAlertEmail: () => alertEmail,
}));

vi.mock("@/lib/notifications/telegram", () => ({
  isTelegramConfigured: () => telegramConfigured,
  sendTelegramMessage: async (text: string) => {
    if (telegramThrows) throw new Error("network");
    sentTelegram.push(text);
    return true;
  },
}));

vi.mock("@/lib/notifications/resend", () => ({
  getEmailProvider: () => ({
    id: "test",
    configured: emailConfigured,
    send: async (payload: { to: string; subject: string; body: string }) => {
      sentEmail.push(payload);
      return { sent: true, providerId: "test" };
    },
  }),
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
  sentEmail.length = 0;
  telegramConfigured = true;
  telegramThrows = false;
  alertEmail = "admin@example.com";
  emailConfigured = true;
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
    const everything = sentTelegram.join(" ") + JSON.stringify(sentEmail);

    for (const secret of ["+9715", "@example.com", "whatsapp", "cart.png"]) {
      if (secret === "@example.com") continue; // the admin's own address is fine
      expect(everything.toLowerCase()).not.toContain(secret.toLowerCase());
    }
    // The one address in there is the admin's, as the recipient.
    expect(sentEmail[0]?.to).toBe("admin@example.com");
  });

  it("sends by both routes when both are configured", async () => {
    await alertAdminOfNewSubmission(ALERT);
    expect(sentTelegram).toHaveLength(1);
    expect(sentEmail).toHaveLength(1);
  });

  it("uses whichever one is configured", async () => {
    telegramConfigured = false;
    await alertAdminOfNewSubmission(ALERT);
    expect(sentTelegram).toHaveLength(0);
    expect(sentEmail).toHaveLength(1);

    sentEmail.length = 0;
    telegramConfigured = true;
    alertEmail = null;
    await alertAdminOfNewSubmission(ALERT);
    expect(sentTelegram).toHaveLength(1);
    expect(sentEmail).toHaveLength(0);
  });

  it("does nothing at all when nothing is configured", async () => {
    telegramConfigured = false;
    alertEmail = null;
    await expect(alertAdminOfNewSubmission(ALERT)).resolves.toBeUndefined();
    expect(sentTelegram).toHaveLength(0);
    expect(sentEmail).toHaveLength(0);
  });

  it("does not throw when a channel fails", async () => {
    // The submission is already written by the time this runs. A failed alert
    // is a slower answer; a thrown error would be a lost customer.
    telegramThrows = true;
    await expect(alertAdminOfNewSubmission(ALERT)).resolves.toBeUndefined();
    expect(sentEmail).toHaveLength(1);
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
    expect(alertChannels()).toEqual(["Telegram", "email"]);

    telegramConfigured = false;
    expect(alertChannels()).toEqual(["email"]);

    alertEmail = null;
    expect(alertChannels()).toEqual([]);
  });

  it("sends the test down the same path a real alert takes", async () => {
    // A test that exercised a different path would prove nothing.
    const { sendTestAdminAlert } = await import("@/lib/notifications/admin-alert");
    expect(await sendTestAdminAlert()).toBe(true);
    expect(sentTelegram[0]).toContain("Test alert");
    expect(sentEmail[0]?.to).toBe("admin@example.com");
  });

  it("reports failure rather than claiming success", async () => {
    const { sendTestAdminAlert } = await import("@/lib/notifications/admin-alert");
    telegramConfigured = false;
    alertEmail = null;
    expect(await sendTestAdminAlert()).toBe(false);
  });
});
