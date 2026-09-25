import { describe, expect, it } from "vitest";
import { calculateManualTotal } from "@/lib/calculations/manual-total";

const parts = { subtotal: "58.00", delivery: "7", service: "2.70", discount: "5" };
describe("manual checkout total", () => {
  it("adds fees and subtracts the AED discount", () => {
    expect(calculateManualTotal(parts).total).toBe("62.70");
    expect(calculateManualTotal({ ...parts, subtotal: "0.10", delivery: "0.20", service: "0", discount: "0" }).total).toBe("0.30");
  });
  it("does not treat missing fees as zero", () => {
    expect(calculateManualTotal({ ...parts, delivery: "" })).toMatchObject({ total: "", errors: { delivery: "Enter an amount, or 0 if none." } });
  });
  it.each(["-1", "abc", "1.001"])("rejects malformed components: %s", (service) => {
    expect(calculateManualTotal({ ...parts, service }).total).toBe("");
  });
  it.each(["67.70", "100", "-10000"])("rejects zero, negative, or invalid totals: %s", (discount) => {
    expect(calculateManualTotal({ ...parts, discount }).total).toBe("");
  });
  it("accepts explicit zero fees and rejects totals over the submission limit", () => {
    expect(calculateManualTotal({ subtotal: "58", delivery: "0", service: "0", discount: "0" }).total).toBe("58.00");
    expect(calculateManualTotal({ ...parts, subtotal: "5000" }).total).toBe("");
  });
});
