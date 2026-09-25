import { describe, expect, it } from "vitest";
import { activePromotionAt, uploadPromotion } from "@/lib/customer/promotion";

describe("upload promotion schedule", () => {
  const start = Date.parse(uploadPromotion.startAt);
  const expiry = Date.parse(uploadPromotion.expiresAt);

  it("uses an inclusive UTC start and exclusive UTC expiry", () => {
    expect(activePromotionAt(uploadPromotion, start - 1)).toBeNull();
    expect(activePromotionAt(uploadPromotion, start)).toBe(uploadPromotion);
    expect(activePromotionAt(uploadPromotion, expiry - 1)).toBe(uploadPromotion);
    expect(activePromotionAt(uploadPromotion, expiry)).toBeNull();
  });

  it("honours the enabled switch and rejects invalid windows", () => {
    expect(activePromotionAt({ ...uploadPromotion, enabled: false }, start)).toBeNull();
    expect(activePromotionAt({ ...uploadPromotion, expiresAt: uploadPromotion.startAt }, start)).toBeNull();
    expect(activePromotionAt({ ...uploadPromotion, startAt: "invalid" }, start)).toBeNull();
  });
});
