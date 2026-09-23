import {
  draftBytes,
  draftEmpty,
  draftJson,
  draftsDisabled,
  presentedToken,
  clearDraftCookie,
} from "@/lib/drafts/http";
import {
  DraftStoreError,
  findDraft,
  isDraftSlot,
  readDraftImage,
  removeDraftImage,
  storeDraftImage,
  type DraftRow,
  type DraftSlot,
} from "@/lib/drafts/store";
import { validateImageFile } from "@/lib/validation/image";
import { checkRateLimit, clientKeyFromHeaders } from "@/lib/utils/rate-limit";
import { MAX_IMAGE_BYTES, RATE_LIMIT_WINDOW_MS } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * One screenshot of a draft: ?slot=cart or ?slot=checkout.
 *
 * The slot is the only thing a request names, and it is one of two fixed
 * words. Which draft, and so which file, comes from the token alone - the path
 * is derived from the draft's own row, so a token can only ever reach the two
 * files that belong to it.
 */

const MAX_UPLOADS_PER_WINDOW = 60;

type Resolved =
  | { ok: true; draft: DraftRow; slot: DraftSlot }
  | { ok: false; response: Response };

async function resolve(request: Request): Promise<Resolved> {
  const disabled = draftsDisabled();
  if (disabled) return { ok: false, response: disabled };

  const slot = new URL(request.url).searchParams.get("slot");
  if (!isDraftSlot(slot)) return { ok: false, response: draftJson({ error: "Invalid slot." }, 400) };

  const presented = presentedToken(request);
  if (!presented) return { ok: false, response: draftJson({ error: "Not found." }, 404) };

  const draft = await findDraft(presented.token);
  if (!draft) {
    const response = draftJson({ error: "Not found." }, 404);
    if (presented.fromCookie) clearDraftCookie(response, request);
    return { ok: false, response };
  }

  return { ok: true, draft, slot };
}

function unavailable(error: unknown) {
  console.error("[drafts] image store unavailable", {
    message: error instanceof Error ? error.message : String(error),
  });
  return draftJson({ error: "Drafts are unavailable." }, 503);
}

export async function PUT(request: Request) {
  const key = clientKeyFromHeaders(request.headers);
  if (!checkRateLimit(`drafts:image:${key}`, MAX_UPLOADS_PER_WINDOW, RATE_LIMIT_WINDOW_MS).allowed) {
    return draftJson({ error: "Too many uploads." }, 429);
  }

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_IMAGE_BYTES + 64 * 1024) {
    return draftJson({ error: "This image is larger than 10 MB." }, 413);
  }

  try {
    const resolved = await resolve(request);
    if (!resolved.ok) return resolved.response;

    let file: FormDataEntryValue | null;
    try {
      file = (await request.formData()).get("image");
    } catch {
      return draftJson({ error: "Unreadable upload." }, 400);
    }
    if (!(file instanceof File)) return draftJson({ error: "No image." }, 400);

    const image = await validateImageFile(file, `${resolved.slot} screenshot`);
    if (!image.ok) return draftJson({ error: image.error }, 400);

    await storeDraftImage(resolved.draft, resolved.slot, image);
    return draftEmpty();
  } catch (error) {
    if (error instanceof DraftStoreError) return unavailable(error);
    throw error;
  }
}

export async function GET(request: Request) {
  try {
    const resolved = await resolve(request);
    if (!resolved.ok) return resolved.response;

    const image = await readDraftImage(resolved.draft, resolved.slot);
    if (!image) return draftJson({ error: "Not found." }, 404);
    return draftBytes(image.bytes, image.mimeType);
  } catch (error) {
    if (error instanceof DraftStoreError) return unavailable(error);
    throw error;
  }
}

export async function DELETE(request: Request) {
  try {
    const resolved = await resolve(request);
    if (!resolved.ok) return resolved.response;

    await removeDraftImage(resolved.draft, resolved.slot);
    return draftEmpty();
  } catch (error) {
    if (error instanceof DraftStoreError) return unavailable(error);
    throw error;
  }
}
