/** Edit this one object to schedule, change, or disable the upload-screen promotion. */
export interface PromotionConfig {
  enabled: boolean;
  label: string;
  headline: string;
  supportingLine: string;
  message: string;
  supportingText: string;
  disclaimer: string;
  /** Inclusive UTC instant, in ISO 8601 format. */
  startAt: string;
  /** Exclusive UTC instant, in ISO 8601 format. */
  expiresAt: string;
}

export const uploadPromotion: PromotionConfig = {
  enabled: false,
  label: "🔥 KEETA WEEK",
  headline: "50% OFF",
  supportingLine: "at select restaurants today",
  message: "Your favourite restaurant might be included.",
  supportingText: "Upload your cart — we’ll check if Keeta is cheaper.",
  disclaimer: "Availability varies by restaurant and area.",
  startAt: "2026-09-25T00:00:00Z",
  expiresAt: "2026-10-02T00:00:00Z",
};

export function activePromotionAt(
  promotion: PromotionConfig,
  now: number,
): PromotionConfig | null {
  const start = Date.parse(promotion.startAt);
  const expiry = Date.parse(promotion.expiresAt);
  return promotion.enabled && Number.isFinite(start) && Number.isFinite(expiry) &&
    start < expiry && now >= start && now < expiry ? promotion : null;
}

/** Read at request time, never during a client render. */
export function currentUploadPromotion(): PromotionConfig | null {
  return activePromotionAt(uploadPromotion, Date.now());
}
