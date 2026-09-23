import "server-only";

import { STORAGE_BUCKET } from "@/lib/constants";
import { createAdminClient } from "@/lib/supabase/admin";
import { detectImageType, type ImageValidationSuccess } from "@/lib/validation/image";
import { generateDraftToken, hashDraftToken, isWellFormedDraftToken } from "./token";
import type { DraftProgress } from "./progress";

/**
 * Wizard drafts in the database and the private bucket.
 *
 * The one rule this module exists to keep: a request proves which draft it
 * owns with its token, and everything else - the row, and every storage path
 * the row points at - is looked up from that proof. Nothing here accepts a
 * path, an id or a slot name it has not produced or checked itself.
 */

export const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
const TABLE = "wizard_drafts";
const PREFIX = "drafts";
const PRUNE_BATCH = 200;

export type DraftSlot = "cart" | "checkout";

export function isDraftSlot(value: unknown): value is DraftSlot {
  return value === "cart" || value === "checkout";
}

export interface DraftRow {
  id: string;
  progress: unknown;
  cart_image_path: string | null;
  checkout_image_path: string | null;
  expires_at: string;
}

/** The database or the bucket failed, or the migration has not been run. */
export class DraftStoreError extends Error {}

const COLUMNS = "id, progress, cart_image_path, checkout_image_path, expires_at";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function expiry(now = Date.now()): string {
  return new Date(now + DRAFT_TTL_MS).toISOString();
}

function pathColumn(slot: DraftSlot): "cart_image_path" | "checkout_image_path" {
  return slot === "cart" ? "cart_image_path" : "checkout_image_path";
}

/** The only way a draft image path is ever made. */
export function draftImagePath(draftId: string, slot: DraftSlot, extension: string): string {
  return `${PREFIX}/${draftId}/${slot}.${extension}`;
}

function fail(message: string, error: { message?: string } | null): never {
  throw new DraftStoreError(`${message}: ${error?.message ?? "unknown error"}`);
}

export async function createDraft(progress: DraftProgress): Promise<{ token: string; draft: DraftRow }> {
  const token = generateDraftToken();
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from(TABLE)
    .insert({ token_hash: await hashDraftToken(token), progress, expires_at: expiry() })
    .select(COLUMNS)
    .single<DraftRow>();

  if (error || !data) fail("could not create a draft", error);
  return { token, draft: data };
}

/** The live draft this token opens, or null. Expired drafts open nothing. */
export async function findDraft(token: unknown): Promise<DraftRow | null> {
  if (!isWellFormedDraftToken(token)) return null;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select(COLUMNS)
    .eq("token_hash", await hashDraftToken(token))
    .gt("expires_at", new Date().toISOString())
    .maybeSingle<DraftRow>();

  if (error) fail("could not read a draft", error);
  return data ?? null;
}

export async function saveDraftProgress(draft: DraftRow, progress: DraftProgress): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from(TABLE)
    .update({ progress, updated_at: new Date().toISOString(), expires_at: expiry() })
    .eq("id", draft.id);

  if (error) fail("could not save draft progress", error);
}

export async function storeDraftImage(
  draft: DraftRow,
  slot: DraftSlot,
  image: ImageValidationSuccess,
): Promise<void> {
  const supabase = createAdminClient();
  const bucket = supabase.storage.from(STORAGE_BUCKET);
  const path = draftImagePath(draft.id, slot, image.extension);
  const previous = draft[pathColumn(slot)];

  const upload = await bucket.upload(path, image.bytes, {
    contentType: image.mimeType,
    upsert: true,
  });
  if (upload.error) fail("could not store a draft image", upload.error);

  const { error } = await supabase
    .from(TABLE)
    .update({
      [pathColumn(slot)]: path,
      updated_at: new Date().toISOString(),
      expires_at: expiry(),
    })
    .eq("id", draft.id);

  if (error) {
    await bucket.remove([path]);
    fail("could not record a draft image", error);
  }

  // A different format leaves the old file behind under another extension.
  if (previous && previous !== path) await bucket.remove([previous]);
}

export async function readDraftImage(
  draft: DraftRow,
  slot: DraftSlot,
): Promise<{ bytes: Uint8Array; mimeType: string } | null> {
  const path = draft[pathColumn(slot)];
  if (!path) return null;

  const supabase = createAdminClient();
  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).download(path);
  if (error || !data) return null;

  // Checked again on the way out: only ever an image, whatever is stored.
  const bytes = new Uint8Array(await data.arrayBuffer());
  const mimeType = detectImageType(bytes);
  return mimeType ? { bytes, mimeType } : null;
}

export async function removeDraftImage(draft: DraftRow, slot: DraftSlot): Promise<void> {
  const path = draft[pathColumn(slot)];
  const supabase = createAdminClient();

  const { error } = await supabase
    .from(TABLE)
    .update({ [pathColumn(slot)]: null, updated_at: new Date().toISOString() })
    .eq("id", draft.id);
  if (error) fail("could not clear a draft image", error);

  if (path) await supabase.storage.from(STORAGE_BUCKET).remove([path]);
}

/** Files first, then the row; files a failed removal leaves are swept as orphans. */
export async function deleteDraft(draft: DraftRow): Promise<void> {
  const supabase = createAdminClient();
  const paths = [draft.cart_image_path, draft.checkout_image_path].filter(
    (path): path is string => Boolean(path),
  );
  if (paths.length > 0) await supabase.storage.from(STORAGE_BUCKET).remove(paths);

  const { error } = await supabase.from(TABLE).delete().eq("id", draft.id);
  if (error) fail("could not delete a draft", error);
}

export interface PruneOutcome {
  expiredDrafts: number;
  orphanFolders: number;
  filesRemoved: number;
  /** Set when 0027_wizard_drafts.sql has not been run, so there is nothing to prune. */
  skipped?: "table missing";
}

/** Postgres' "undefined table", and PostgREST's name for the same thing. */
function isMissingTable(error: { code?: string } | null): boolean {
  return error?.code === "42P01" || error?.code === "PGRST205";
}

/**
 * Expired drafts, and any drafts/ folder whose row no longer exists.
 *
 * The second half is what makes cleanup complete rather than best-effort: a
 * finished submission deletes its draft straight away, and if removing the
 * files failed at that moment - or at any other - the folder is found here.
 * A folder only ever appears after its row was written, so one without a row
 * is abandoned, never in progress.
 */
export async function pruneDrafts(now = new Date()): Promise<PruneOutcome> {
  const supabase = createAdminClient();
  const bucket = supabase.storage.from(STORAGE_BUCKET);
  const outcome: PruneOutcome = { expiredDrafts: 0, orphanFolders: 0, filesRemoved: 0 };

  const { data: expired, error } = await supabase
    .from(TABLE)
    .select("id, cart_image_path, checkout_image_path")
    .lt("expires_at", now.toISOString())
    .limit(PRUNE_BATCH);
  if (isMissingTable(error)) return { ...outcome, skipped: "table missing" };
  if (error) fail("could not list expired drafts", error);

  const rows = (expired ?? []) as Pick<DraftRow, "id" | "cart_image_path" | "checkout_image_path">[];
  if (rows.length > 0) {
    const paths = rows.flatMap((row) =>
      [row.cart_image_path, row.checkout_image_path].filter((path): path is string => Boolean(path)),
    );
    if (paths.length > 0) {
      const removed = await bucket.remove(paths);
      if (!removed.error) outcome.filesRemoved += paths.length;
    }

    const { error: deleteError } = await supabase
      .from(TABLE)
      .delete()
      .in("id", rows.map((row) => row.id));
    if (deleteError) fail("could not delete expired drafts", deleteError);
    outcome.expiredDrafts = rows.length;
  }

  const { data: folders, error: listError } = await bucket.list(PREFIX, { limit: PRUNE_BATCH });
  if (listError) fail("could not list draft folders", listError);

  const folderIds = (folders ?? []).map((entry) => entry.name).filter((name) => UUID.test(name));
  if (folderIds.length === 0) return outcome;

  const { data: live, error: liveError } = await supabase.from(TABLE).select("id").in("id", folderIds);
  if (liveError) fail("could not match draft folders", liveError);

  const liveIds = new Set(((live ?? []) as { id: string }[]).map((row) => row.id));
  for (const id of folderIds) {
    if (liveIds.has(id)) continue;

    const { data: files } = await bucket.list(`${PREFIX}/${id}`);
    const paths = (files ?? []).map((file) => `${PREFIX}/${id}/${file.name}`);
    if (paths.length > 0) {
      const removed = await bucket.remove(paths);
      if (!removed.error) outcome.filesRemoved += paths.length;
    }
    outcome.orphanFolders += 1;
  }

  return outcome;
}
