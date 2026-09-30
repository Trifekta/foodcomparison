/**
 * Who is calling: the website, or which version of which app.
 *
 * Every /api/v1 request names itself in one header:
 *
 *   X-SnipSavor-Client: android/1.4.2
 *
 * Two reasons it is required rather than optional. Installed apps cannot be
 * forced to update, so the server must be able to tell an old build it is too
 * old - and it can only do that for a build that says what it is. And the
 * platform is stored on what the call writes, so app traffic never silently
 * lands in the web's numbers.
 *
 * It is a label, not a credential. Anybody can send any value, and nothing it
 * unlocks is worth forging: the worst a lie does is mislabel the liar's own row
 * or excuse them from an upgrade prompt.
 *
 * Pure, so it runs in tests, on the server and anywhere else without setup.
 */

export const CLIENT_HEADER = "x-snipsavor-client";

export const CLIENT_PLATFORMS = ["web", "android", "ios"] as const;
export type ClientPlatform = (typeof CLIENT_PLATFORMS)[number];

/** Platforms that are installed, and so can be out of date. */
export type AppPlatform = Exclude<ClientPlatform, "web">;

export interface ClientInfo {
  platform: ClientPlatform;
  /** major.minor.patch, as the client reported it. */
  appVersion: string;
}

/**
 * Plain semver core only - no pre-release or build suffix. Each part is capped
 * at five digits, which keeps the whole value inside the column's 32 characters
 * and every part inside Number's exact range.
 */
const VERSION_PATTERN = /^(\d{1,5})\.(\d{1,5})\.(\d{1,5})$/;

export function isValidVersion(value: string): boolean {
  return VERSION_PATTERN.test(value);
}

function isClientPlatform(value: string): value is ClientPlatform {
  return (CLIENT_PLATFORMS as readonly string[]).includes(value);
}

/** Null for a missing or malformed header - the caller decides what that costs. */
export function parseClientHeader(value: string | null): ClientInfo | null {
  if (!value) return null;

  const [platform, version, ...rest] = value.trim().toLowerCase().split("/");
  if (rest.length > 0 || !platform || !version) return null;
  if (!isClientPlatform(platform) || !isValidVersion(version)) return null;

  return { platform, appVersion: version };
}

export function readClient(headers: Headers): ClientInfo | null {
  return parseClientHeader(headers.get(CLIENT_HEADER));
}

/** Negative, zero or positive, like any comparator. Both must be valid versions. */
export function compareVersions(a: string, b: string): number {
  const left = a.split(".").map(Number);
  const right = b.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

export type MinimumVersions = Record<AppPlatform, string>;

/**
 * Whether this client may use the API, and the version it would need.
 *
 * The website is never gated: it is deployed, not installed, so whatever is
 * calling is already the current build.
 */
export function versionStatus(
  client: ClientInfo,
  minimums: MinimumVersions,
): { minimumVersion: string | null; updateRequired: boolean } {
  if (client.platform === "web") return { minimumVersion: null, updateRequired: false };

  const minimumVersion = minimums[client.platform];
  return {
    minimumVersion,
    updateRequired: compareVersions(client.appVersion, minimumVersion) < 0,
  };
}

/** The columns a write records about its client (see 0030_client_platform.sql). */
export function clientColumns(client: ClientInfo): {
  client_platform: ClientPlatform;
  app_version: string | null;
} {
  return {
    client_platform: client.platform,
    // The website's version means nothing - it has no installs to be behind.
    app_version: client.platform === "web" ? null : client.appVersion,
  };
}
