import { NextResponse } from "next/server";

/**
 * The /api/v1 response envelope.
 *
 *   success  { "data": ... }
 *   failure  { "error": { "code": "rate_limited", "message": "...", "field"?: "..." } }
 *
 * The code is the contract. An app shows its own words for it, in its own
 * language, and branches on it; the message is the English sentence the
 * website already shows, carried for logs and for a client that has no
 * translation for a code it has never seen. Codes are only ever added - an
 * installed app must never meet a renamed one.
 */

export const API_ERROR_CODES = [
  /** No X-SnipSavor-Client header, or one that does not parse. */
  "client_required",
  /** This app build is older than the platform's minimum. */
  "upgrade_required",
  "rate_limited",
  "payload_too_large",
  /** The body never arrived as the form or JSON it claimed to be. */
  "unreadable_body",
  /** A form field failed validation; `field` names it. */
  "invalid_field",
  "invalid_items",
  "cart_image_missing",
  "image_empty",
  "image_too_large",
  "image_unsupported",
  /** The chosen area does not exist or has been switched off. */
  "area_unavailable",
  "upload_failed",
  "result_not_found",
  "service_unavailable",
  "server_error",
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export interface ApiErrorBody {
  error: { code: ApiErrorCode; message: string; field?: string };
}

/** Nothing under /api/v1 is ever cached by default: it is all per-customer or live. */
const BASE_HEADERS = { "Cache-Control": "no-store" };

export function apiData<T>(
  data: T,
  init: { status?: number; headers?: Record<string, string> } = {},
): NextResponse<{ data: T }> {
  return NextResponse.json(
    { data },
    { status: init.status ?? 200, headers: { ...BASE_HEADERS, ...init.headers } },
  );
}

export function apiError(
  code: ApiErrorCode,
  message: string,
  status: number,
  options: { field?: string; headers?: Record<string, string> } = {},
): NextResponse<ApiErrorBody> {
  return NextResponse.json(
    { error: { code, message, ...(options.field ? { field: options.field } : {}) } },
    { status, headers: { ...BASE_HEADERS, ...options.headers } },
  );
}

export function rateLimited(message: string, retryAfterSeconds: number) {
  return apiError("rate_limited", message, 429, {
    headers: { "Retry-After": String(retryAfterSeconds) },
  });
}
