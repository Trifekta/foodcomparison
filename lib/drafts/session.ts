import { compressForUpload } from "@/lib/images/compress";
import {
  createDraft,
  fetchDraft,
  fetchDraftImage,
  forgetDraftToken,
  hasDraftHint,
  isResumeActive,
  knownDraftToken,
  rememberDraftToken,
  removeDraftImage,
  saveDraftProgress,
  uploadDraftImage,
  type DraftSlot,
  type ResumeMode,
} from "./client";
import type { DraftProgress } from "./progress";

/**
 * One page view's connection to its server-side draft.
 *
 * A draft is created the first time a screenshot is chosen - before that there
 * is nothing worth a round trip to recover - and from then on every change to
 * the wizard is saved shortly after it happens, immediately when the step
 * changes, and once more with keepalive as the page is hidden, which is the
 * moment a phone may discard it.
 */

const SAVE_DELAY_MS = 700;
const RESTORE_TIMEOUT_MS = 10_000;

export interface RestoredDraft {
  progress: DraftProgress | null;
  files: Record<DraftSlot, File | null>;
}

export class DraftSession {
  private readonly active: boolean;
  private token: string | null = null;
  private creating: Promise<string | null> | null = null;
  private latest: DraftProgress | null = null;
  private dirty = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private finished = false;
  private imageChain: Record<DraftSlot, Promise<void>> = {
    cart: Promise.resolve(),
    checkout: Promise.resolve(),
  };

  constructor(mode: ResumeMode) {
    this.active = typeof window !== "undefined" && isResumeActive(mode, window.location.search);
  }

  get isActive(): boolean {
    return this.active;
  }

  /** Whether there is anything to look for, so the wizard knows to wait for it. */
  get mayRestore(): boolean {
    return this.active && (knownDraftToken() !== null || hasDraftHint());
  }

  get currentToken(): string | null {
    return this.token;
  }

  async restore(): Promise<RestoredDraft | null> {
    if (!this.mayRestore) return null;

    const known = knownDraftToken();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), RESTORE_TIMEOUT_MS);

    try {
      const found = await fetchDraft(known, controller.signal);
      if (found === "gone") {
        forgetDraftToken();
        return null;
      }
      if (!found) {
        // Unreachable rather than gone: keep saving to it if it comes back.
        this.token = known;
        return null;
      }

      this.token = found.token;
      rememberDraftToken(found.token);

      const [cart, checkout] = await Promise.all([
        found.images.cart ? fetchDraftImage(found.token, "cart", controller.signal) : null,
        found.images.checkout ? fetchDraftImage(found.token, "checkout", controller.signal) : null,
      ]);

      return { progress: found.progress, files: { cart, checkout } };
    } finally {
      clearTimeout(timeout);
      // Whatever was recorded before the restore landed describes an empty
      // wizard; the next update() describes the restored one.
      this.latest = null;
      this.dirty = false;
    }
  }

  /** The wizard's current state. Saved shortly, once a draft exists. */
  update(progress: DraftProgress): void {
    if (!this.active || this.finished) return;
    this.latest = progress;
    this.dirty = true;
    if (!this.token) return;

    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), SAVE_DELAY_MS);
  }

  async flush(keepalive = false): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (!this.token || !this.latest || !this.dirty || this.finished) return;

    this.dirty = false;
    const ok = await saveDraftProgress(this.token, this.latest, keepalive);
    if (!ok) this.dirty = true;
  }

  /** A screenshot was chosen (file) or removed (null). Serialised per slot. */
  syncImage(slot: DraftSlot, file: File | null): Promise<void> {
    if (!this.active || this.finished) return Promise.resolve();

    const run = async () => {
      if (!file) {
        if (this.token) await removeDraftImage(this.token, slot);
        return;
      }
      const token = await this.ensureToken();
      if (!token) return;
      await uploadDraftImage(token, slot, await compressForUpload(file));
    };

    this.imageChain[slot] = this.imageChain[slot].then(run, run);
    return this.imageChain[slot];
  }

  /** The order went in; the server has already thrown the draft away. */
  finish(): void {
    this.finished = true;
    if (this.timer) clearTimeout(this.timer);
    this.token = null;
    forgetDraftToken();
  }

  private ensureToken(): Promise<string | null> {
    if (this.token) return Promise.resolve(this.token);
    if (this.creating) return this.creating;
    if (!this.latest) return Promise.resolve(null);

    this.creating = createDraft(this.latest).then((token) => {
      this.creating = null;
      if (token && !this.finished) {
        this.token = token;
        rememberDraftToken(token);
        if (this.latest) this.update(this.latest);
      }
      return this.token;
    });
    return this.creating;
  }
}
