import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clientColumns,
  compareVersions,
  parseClientHeader,
  versionStatus,
} from "@/lib/api/v1/client";
import { getMinimumAppVersions } from "@/lib/env";

/**
 * The X-SnipSavor-Client header and the version gate built on it.
 *
 * Installed apps cannot be forced to update, so this is the one lever the
 * server has over an old build. What is pinned: a malformed header is refused
 * rather than guessed at, versions compare numerically (1.10 is newer than
 * 1.9), the website is never gated, and a typo in the minimum never locks
 * every app out.
 */

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("parseClientHeader", () => {
  it.each([
    ["android/1.4.2", { platform: "android", appVersion: "1.4.2" }],
    ["ios/0.1.0", { platform: "ios", appVersion: "0.1.0" }],
    ["web/1.0.0", { platform: "web", appVersion: "1.0.0" }],
    ["  Android/2.0.10 ", { platform: "android", appVersion: "2.0.10" }],
  ])("reads %j", (header, expected) => {
    expect(parseClientHeader(header)).toEqual(expected);
  });

  it.each([
    null,
    "",
    "android",
    "android/",
    "/1.0.0",
    "windows/1.0.0",
    "android/1.0",
    "android/1.0.0-beta",
    "android/1.0.0/extra",
    "android/v1.0.0",
    "android/123456.0.0",
  ])("refuses %j", (header) => {
    expect(parseClientHeader(header)).toBeNull();
  });
});

describe("compareVersions", () => {
  it("compares numerically, not as text", () => {
    expect(compareVersions("1.10.0", "1.9.0")).toBeGreaterThan(0);
    expect(compareVersions("1.2.3", "1.2.3")).toBe(0);
    expect(compareVersions("0.9.9", "1.0.0")).toBeLessThan(0);
    expect(compareVersions("2.0.0", "1.99.99")).toBeGreaterThan(0);
  });
});

describe("versionStatus", () => {
  const minimums = { android: "1.2.0", ios: "2.0.0" };

  it("gates each platform on its own minimum", () => {
    expect(versionStatus({ platform: "android", appVersion: "1.1.9" }, minimums)).toEqual({
      minimumVersion: "1.2.0",
      updateRequired: true,
    });
    expect(versionStatus({ platform: "android", appVersion: "1.2.0" }, minimums).updateRequired).toBe(
      false,
    );
    expect(versionStatus({ platform: "ios", appVersion: "1.9.0" }, minimums).updateRequired).toBe(true);
  });

  it("never gates the website", () => {
    expect(versionStatus({ platform: "web", appVersion: "0.0.1" }, minimums)).toEqual({
      minimumVersion: null,
      updateRequired: false,
    });
  });
});

describe("clientColumns", () => {
  it("records the app's platform and version", () => {
    expect(clientColumns({ platform: "ios", appVersion: "1.0.3" })).toEqual({
      client_platform: "ios",
      app_version: "1.0.3",
    });
  });

  it("records no version for the website", () => {
    expect(clientColumns({ platform: "web", appVersion: "9.9.9" })).toEqual({
      client_platform: "web",
      app_version: null,
    });
  });
});

describe("getMinimumAppVersions", () => {
  it("allows every build when unset", () => {
    vi.stubEnv("MOBILE_MIN_VERSION_ANDROID", "");
    vi.stubEnv("MOBILE_MIN_VERSION_IOS", "");
    expect(getMinimumAppVersions()).toEqual({ android: "0.0.0", ios: "0.0.0" });
  });

  it("reads each platform's minimum", () => {
    vi.stubEnv("MOBILE_MIN_VERSION_ANDROID", " 1.3.0 ");
    vi.stubEnv("MOBILE_MIN_VERSION_IOS", "2.1.4");
    expect(getMinimumAppVersions()).toEqual({ android: "1.3.0", ios: "2.1.4" });
  });

  it("treats a malformed minimum as unset rather than locking everybody out", () => {
    vi.stubEnv("MOBILE_MIN_VERSION_ANDROID", "1.3");
    vi.stubEnv("MOBILE_MIN_VERSION_IOS", "latest");
    expect(getMinimumAppVersions()).toEqual({ android: "0.0.0", ios: "0.0.0" });
  });
});
