import { describe, expect, it, vi } from "vitest";
import { createItemKey } from "@/lib/customer/item-key";

describe("basket item identity", () => {
  it("works without browser crypto and avoids keys restored from a draft", () => {
    vi.stubGlobal("crypto", undefined);
    try {
      const restored = Array.from({ length: 100 }, (_, i) => ({ key: `item-${i + 1}` }));
      const first = createItemKey(restored);
      expect(restored.some((item) => item.key === first)).toBe(false);
      const second = createItemKey([...restored, { key: first }]);
      expect(second).not.toBe(first);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
