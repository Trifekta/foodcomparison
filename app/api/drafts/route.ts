import { draftProgressSchema, MAX_PROGRESS_BYTES } from "@/lib/drafts/progress";
import {
  clearDraftCookie,
  draftEmpty,
  draftJson,
  draftsDisabled,
  presentedToken,
  readBoundedJson,
  setDraftCookie,
} from "@/lib/drafts/http";
import {
  DraftStoreError,
  createDraft,
  deleteDraft,
  findDraft,
  saveDraftProgress,
} from "@/lib/drafts/store";
import { checkRateLimit, clientKeyFromHeaders } from "@/lib/utils/rate-limit";
import { RATE_LIMIT_WINDOW_MS } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * A wizard draft: create it, read it back, keep it current, throw it away.
 *
 * Every call but POST proves ownership with the token (header, or the HttpOnly
 * cookie). There is no way to name a draft by id, and an unknown, expired or
 * malformed token gets the same 404 as a draft that never existed.
 */

const MAX_CREATES_PER_WINDOW = 10;
const MAX_WRITES_PER_WINDOW = 300;

function unavailable(error: unknown) {
  console.error("[drafts] store unavailable", {
    message: error instanceof Error ? error.message : String(error),
  });
  return draftJson({ error: "Drafts are unavailable." }, 503);
}

function notFound(request: Request, clearCookie: boolean) {
  const response = draftJson({ error: "Not found." }, 404);
  if (clearCookie) clearDraftCookie(response, request);
  return response;
}

export async function POST(request: Request) {
  const disabled = draftsDisabled();
  if (disabled) return disabled;

  const key = clientKeyFromHeaders(request.headers);
  if (!checkRateLimit(`drafts:create:${key}`, MAX_CREATES_PER_WINDOW, RATE_LIMIT_WINDOW_MS).allowed) {
    return draftJson({ error: "Too many drafts." }, 429);
  }

  const parsed = draftProgressSchema.safeParse(await readBoundedJson(request, MAX_PROGRESS_BYTES));
  if (!parsed.success) return draftJson({ error: "Invalid progress." }, 400);

  try {
    const { token } = await createDraft(parsed.data);
    const response = draftJson({ token }, 201);
    setDraftCookie(response, request, token);
    return response;
  } catch (error) {
    if (error instanceof DraftStoreError) return unavailable(error);
    throw error;
  }
}

export async function GET(request: Request) {
  const disabled = draftsDisabled();
  if (disabled) return disabled;

  const presented = presentedToken(request);
  if (!presented) return notFound(request, false);

  try {
    const draft = await findDraft(presented.token);
    if (!draft) return notFound(request, presented.fromCookie);

    const progress = draftProgressSchema.safeParse(draft.progress);
    const response = draftJson({
      token: presented.token,
      progress: progress.success ? progress.data : null,
      images: { cart: Boolean(draft.cart_image_path), checkout: Boolean(draft.checkout_image_path) },
    });
    // Renewed, so a draft reached by URL alone gets its backup copy back.
    setDraftCookie(response, request, presented.token);
    return response;
  } catch (error) {
    if (error instanceof DraftStoreError) return unavailable(error);
    throw error;
  }
}

export async function PUT(request: Request) {
  const disabled = draftsDisabled();
  if (disabled) return disabled;

  const key = clientKeyFromHeaders(request.headers);
  if (!checkRateLimit(`drafts:write:${key}`, MAX_WRITES_PER_WINDOW, RATE_LIMIT_WINDOW_MS).allowed) {
    return draftJson({ error: "Too many saves." }, 429);
  }

  const presented = presentedToken(request);
  if (!presented) return notFound(request, false);

  const parsed = draftProgressSchema.safeParse(await readBoundedJson(request, MAX_PROGRESS_BYTES));
  if (!parsed.success) return draftJson({ error: "Invalid progress." }, 400);

  try {
    const draft = await findDraft(presented.token);
    if (!draft) return notFound(request, presented.fromCookie);

    await saveDraftProgress(draft, parsed.data);
    return draftEmpty();
  } catch (error) {
    if (error instanceof DraftStoreError) return unavailable(error);
    throw error;
  }
}

export async function DELETE(request: Request) {
  const disabled = draftsDisabled();
  if (disabled) return disabled;

  const presented = presentedToken(request);
  const response = draftEmpty();
  clearDraftCookie(response, request);
  if (!presented) return response;

  try {
    const draft = await findDraft(presented.token);
    if (draft) await deleteDraft(draft);
    return response;
  } catch (error) {
    if (error instanceof DraftStoreError) return unavailable(error);
    throw error;
  }
}
