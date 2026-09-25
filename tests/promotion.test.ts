import { describe, expect, it } from "vitest";
import { activePromotionAt, uploadPromotion } from "@/lib/customer/promotion";

describe("upload promotion schedule", () => {
  const scheduledPromotion = { ...uploadPromotion, enabled: true };
  const start = Date.parse(uploadPromotion.startAt);
  const expiry = Date.parse(uploadPromotion.expiresAt);

  it("uses an inclusive UTC start and exclusive UTC expiry", () => {
    expect(activePromotionAt(scheduledPromotion, start - 1)).toBeNull();
    expect(activePromotionAt(scheduledPromotion, start)).toBe(scheduledPromotion);
    expect(activePromotionAt(scheduledPromotion, expiry - 1)).toBe(scheduledPromotion);
    expect(activePromotionAt(scheduledPromotion, expiry)).toBeNull();
  });

  it("honours the enabled switch and rejects invalid windows", () => {
    expect(activePromotionAt(uploadPromotion, start)).toBeNull();
    expect(activePromotionAt({ ...scheduledPromotion, expiresAt: uploadPromotion.startAt }, start)).toBeNull();
    expect(activePromotionAt({ ...scheduledPromotion, startAt: "invalid" }, start)).toBeNull();
  });
});
