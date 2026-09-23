import "server-only";

import { NextResponse } from "next/server";
import { getDraftResumeMode } from "@/lib/env";
import { isWellFormedDraftToken } from "./token";
import { DRAFT_TTL_MS } from "./store";

/**
 * Request and response plumbing shared by the draft routes.
 *
 * The token travels in a header, never a query string, so it cannot land in a
 * request log or a Referer. The cookie is a second copy the browser keeps
 * without any script being able to read it - HttpOnly, and scoped to /api so
 * it rides only on requests to this app's own endpoints.
 */

export const DRAFT_TOKEN_HEADER = "x-draft-token";
export const DRAFT_COOKIE = "snipsavor_draft";
const COOKIE_PATH = "/api";

/**
 * A readable "there may be a draft" flag, holding nothing secret.
 *
 * The real cookie is HttpOnly, so the page cannot tell whether it exists -
 * and asking the server on every arrival would put a round trip in front of
 * every advert click. This one only decides whether that request is worth
 * making.
 */
export const DRAFT_HINT_COOKIE = "snipsavor_draft_hint";

/** Every draft response: never cached, never passes a Referer on. */
const PRIVATE_HEADERS = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

export function draftJson(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: PRIVATE_HEADERS });
}

export function draftEmpty(status = 204): NextResponse {
  return new NextResponse(null, { status, headers: PRIVATE_HEADERS });
}

export function draftBytes(bytes: Uint8Array, mimeType: string): NextResponse {
  return new NextResponse(bytes as unknown as BodyInit, {
    status: 200,
    headers: { ...PRIVATE_HEADERS, "Content-Type": mimeType },
  });
}

/** The same answer for "flag off" and "no such route", so neither is discoverable. */
export function draftsDisabled(): NextResponse | null {
  return getDraftResumeMode() === "off" ? draftJson({ error: "Not found." }, 404) : null;
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export interface PresentedToken {
  token: string;
  fromCookie: boolean;
}

/** Header first; the cookie only when no header was sent at all. */
export function presentedToken(request: Request): PresentedToken | null {
  const header = request.headers.get(DRAFT_TOKEN_HEADER);
  if (header !== null) return isWellFormedDraftToken(header) ? { token: header, fromCookie: false } : null;

  const cookie = readCookie(request, DRAFT_COOKIE);
  return isWellFormedDraftToken(cookie) ? { token: cookie, fromCookie: true } : null;
}

export function hasDraftCookie(request: Request): boolean {
  return readCookie(request, DRAFT_COOKIE) !== null;
}

function secure(request: Request): boolean {
  return new URL(request.url).protocol === "https:";
}

export function setDraftCookie(response: NextResponse, request: Request, token: string): void {
  response.cookies.set(DRAFT_COOKIE, token, {
    httpOnly: true,
    secure: secure(request),
    sameSite: "lax",
    path: COOKIE_PATH,
    maxAge: Math.floor(DRAFT_TTL_MS / 1000),
  });
  response.cookies.set(DRAFT_HINT_COOKIE, "1", {
    secure: secure(request),
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(DRAFT_TTL_MS / 1000),
  });
}

export function clearDraftCookie(response: NextResponse, request: Request): void {
  response.cookies.set(DRAFT_COOKIE, "", {
    httpOnly: true,
    secure: secure(request),
    sameSite: "lax",
    path: COOKIE_PATH,
    maxAge: 0,
  });
  response.cookies.set(DRAFT_HINT_COOKIE, "", {
    secure: secure(request),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/** Reads a JSON body without trusting its declared or actual size. */
export async function readBoundedJson(request: Request, maxBytes: number): Promise<unknown> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > maxBytes) return undefined;

  const text = await request.text();
  if (new TextEncoder().encode(text).length > maxBytes) return undefined;

  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
