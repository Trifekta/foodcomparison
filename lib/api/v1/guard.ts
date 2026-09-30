import "server-only";

import type { NextResponse } from "next/server";
import { absoluteUrl, getMinimumAppVersions } from "@/lib/env";
import { readClient, versionStatus, type ClientInfo } from "./client";
import { apiError, type ApiErrorBody } from "./response";

export type ClientCheck =
  | {
      ok: true;
      client: ClientInfo;
      minimumVersion: string | null;
      updateRequired: boolean;
    }
  | { ok: false; response: NextResponse<ApiErrorBody> };

/**
 * The first thing every /api/v1 handler does: find out who is calling, and turn
 * away a build that is too old.
 *
 * `allowOutdated` is for /api/v1/config alone. That is where an app learns it
 * must update, so it has to keep answering the very builds everything else
 * refuses - otherwise an old app could not even find out why it stopped working.
 */
export function checkClient(
  request: Request,
  options: { allowOutdated?: boolean } = {},
): ClientCheck {
  const client = readClient(request.headers);
  if (!client) {
    return {
      ok: false,
      response: apiError(
        "client_required",
        "Send X-SnipSavor-Client as <web|android|ios>/<major.minor.patch>.",
        400,
      ),
    };
  }

  const status = versionStatus(client, getMinimumAppVersions());
  if (status.updateRequired && !options.allowOutdated) {
    // 426 Upgrade Required: the status that says exactly this.
    return {
      ok: false,
      response: apiError(
        "upgrade_required",
        "Please update the SnipSavor app to continue.",
        426,
      ),
    };
  }

  return { ok: true, client, ...status };
}

/**
 * An absolute link to a path on this site, for a client that is not a browser
 * sitting on the site already.
 *
 * NEXT_PUBLIC_APP_URL first, because it is the canonical domain - the one the
 * app's verified deep links are registered against. The request's own origin
 * otherwise, which is where the app evidently reached us.
 */
export function absoluteLink(path: string, request: Request): string {
  return absoluteUrl(path) ?? new URL(path, request.url).toString();
}
