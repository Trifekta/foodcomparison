import { describe, expect, it } from "vitest";
import { pushNextStep, type PushStatus } from "@/lib/push/status";

/**
 * Which problem to name first.
 *
 * Push fails in four places and looks identical in all of them, so the value of
 * this page is entirely in saying the *one* thing to go and do. The order
 * matters: telling somebody to register a device when the server has no keys
 * sends them looking for a button that is not on the screen.
 */

function status(overrides: Partial<PushStatus> = {}): PushStatus {
  return {
    configured: true,
    subject: "mailto:admin@snipsavor.com",
    adminDevices: 1,
    customerDevices: 0,
    tableReadable: true,
    tableError: null,
    chaserConfigured: true,
    chaserAfterMinutes: 10,
    appUrl: "https://snipsavor.trifekta.io",
    ...overrides,
  };
}

describe("the one thing to go and do", () => {
  it("says nothing when everything is in place", () => {
    expect(pushNextStep(status())).toBeNull();
  });

  it("names the migration before anything else", () => {
    const step = pushNextStep(
      status({ tableReadable: false, configured: false, adminDevices: 0 }),
    );
    expect(step).toContain("0012_push_subscriptions.sql");
  });

  it("asks for the keys before asking for a device", () => {
    const step = pushNextStep(status({ configured: false, adminDevices: 0 }));
    expect(step).toContain("WEB_PUSH_PRIVATE_KEY");
    expect(step).not.toContain("Enable new request notifications");
  });

  /**
   * The likeliest cause of silence, and the one nothing else reports: the
   * server is configured, but nobody ever pressed the button.
   */
  it("says no device is registered once the keys are there", () => {
    const step = pushNextStep(status({ adminDevices: 0 }));
    expect(step).toContain("No device is registered");
    // The iPhone caveat belongs here specifically. On iOS the button does not
    // appear in a Safari tab at all, so somebody looking for it will not find
    // it and will assume the feature is broken.
    expect(step).toContain("Home Screen");
  });

  it("mentions the chaser only once the rest works", () => {
    const step = pushNextStep(status({ chaserConfigured: false }));
    expect(step).toContain("CRON_SECRET");
    expect(step).toContain("10 minutes");
  });
});
