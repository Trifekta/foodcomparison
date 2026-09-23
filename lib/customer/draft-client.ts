"use client";

import { visitId } from "@/lib/analytics/track";

export interface DraftData {
  id: string;
  cartImagePath: string | null;
  checkoutImagePath: string | null;
  step: number;
  state: object;
}

/**
 * Upload a screenshot to temporary draft storage.
 *
 * Called when a screenshot is picked, returns the storage path.
 */
export async function uploadDraftFile(
  file: File,
  type: "cart" | "checkout"
): Promise<{ path: string } | { error: string }> {
  const vid = visitId();
  if (!vid) return { error: "No visit ID" };

  try {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(
      `/api/draft-uploads?visitId=${encodeURIComponent(vid)}&type=${type}`,
      { method: "POST", body: formData }
    );

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      return { error: data?.error ?? "Upload failed" };
    }

    const data = (await response.json()) as { path?: string };
    if (!data.path) return { error: "No path returned" };
    return { path: data.path };
  } catch (error) {
    console.error("[draft-client] upload failed", error);
    return {
      error: error instanceof Error ? error.message : "Upload failed",
    };
  }
}

/**
 * Save or update a draft.
 *
 * Called after a screenshot is uploaded or form state changes.
 */
export async function saveDraft(data: {
  step: number;
  state: object;
  cartImagePath?: string | null;
  checkoutImagePath?: string | null;
}): Promise<DraftData | { error: string }> {
  const vid = visitId();
  if (!vid) return { error: "No visit ID" };

  try {
    const response = await fetch("/api/drafts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        visitId: vid,
        step: data.step,
        state: data.state,
        cartImagePath: data.cartImagePath ?? null,
        checkoutImagePath: data.checkoutImagePath ?? null,
      }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      return { error: payload?.error ?? "Save failed" };
    }

    const payload = (await response.json()) as { draft?: DraftData };
    if (!payload.draft) return { error: "No draft returned" };
    return payload.draft;
  } catch (error) {
    console.error("[draft-client] save failed", error);
    return { error: error instanceof Error ? error.message : "Save failed" };
  }
}

/**
 * Restore a draft for this visit.
 *
 * Called on component mount to recover previous progress.
 */
export async function restoreDraft(): Promise<DraftData | null> {
  const vid = visitId();
  if (!vid) return null;

  try {
    const response = await fetch(`/api/drafts?visitId=${encodeURIComponent(vid)}`);

    if (!response.ok) return null;

    const payload = (await response.json()) as { draft?: DraftData | null };
    return payload.draft ?? null;
  } catch (error) {
    console.error("[draft-client] restore failed", error);
    return null;
  }
}
