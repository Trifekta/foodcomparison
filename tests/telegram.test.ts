import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The one hand-rolled HTTP call in the alert path.
 *
 * Worth pinning precisely because there is no SDK to catch a wrong field name,
 * and a silently rejected request reads exactly like "nobody told me an order
 * came in".
 */

let config: { botToken: string; chatId: string } | null = { botToken: "123:ABC", chatId: "987" };

vi.mock("@/lib/env", () => ({ getTelegramConfig: () => config }));

const { isTelegramConfigured, sendTelegramMessage } = await import("@/lib/notifications/telegram");

const calls: Array<{ url: string; init: RequestInit }> = [];
let response: { ok: boolean } | Error = { ok: true };

beforeEach(() => {
  calls.length = 0;
  config = { botToken: "123:ABC", chatId: "987" };
  response = { ok: true };
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    if (response instanceof Error) throw response;
    return response as Response;
  }) as unknown as typeof fetch;
});

describe("sendTelegramMessage", () => {
  it("posts what Telegram expects", async () => {
    expect(await sendTelegramMessage("New price check · T829B3")).toBe(true);
    expect(calls[0].url).toBe("https://api.telegram.org/bot123:ABC/sendMessage");
    expect(calls[0].init.method).toBe("POST");
    expect(JSON.parse(String(calls[0].init.body))).toMatchObject({
      chat_id: "987",
      text: "New price check · T829B3",
      disable_web_page_preview: true,
    });
  });

  it("does not call out at all when no bot is configured", async () => {
    config = null;
    expect(isTelegramConfigured()).toBe(false);
    expect(await sendTelegramMessage("anything")).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it("reports a refusal rather than throwing", async () => {
    response = { ok: false };
    expect(await sendTelegramMessage("anything")).toBe(false);
  });

  it("survives the network being down", async () => {
    response = new Error("ECONNRESET");
    expect(await sendTelegramMessage("anything")).toBe(false);
  });
});
