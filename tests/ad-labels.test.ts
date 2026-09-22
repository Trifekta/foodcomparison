import { describe, expect, it } from "vitest";
import {
  BUILT_IN_AD_LABELS,
  buildAdLabelIndex,
  resolveAdLabel,
} from "@/lib/analytics/ad-labels";
import { adLabelInputSchema } from "@/lib/validation/admin";

/**
 * Reading an advert's numbers back as words.
 *
 * The rules worth pinning down are the ones about precedence and about what
 * happens to a value nobody has registered - a resolver that only handles the
 * ids it was told about would send the admin back to Ads Manager the first
 * time somebody launched a creative.
 */

const builtIns = buildAdLabelIndex(BUILT_IN_AD_LABELS);

describe("resolving a stored advert value", () => {
  it("names the campaign and creative that were already running", () => {
    expect(resolveAdLabel("campaign", "120249042250420301", builtIns)).toMatchObject({
      label: "SnipSavor Validation",
      raw: "120249042250420301",
    });
    expect(resolveAdLabel("creative", "120249042878960301", builtIns)).toMatchObject({
      label: "Same Order Different Price",
      raw: "120249042878960301",
    });
  });

  it("folds the several ways Meta writes one source into one name", () => {
    // Left alone these sort as two sources and split one campaign in half.
    expect(resolveAdLabel("source", "instagram", builtIns).label).toBe("Instagram");
    expect(resolveAdLabel("source", "ig", builtIns).label).toBe("Instagram");
    expect(resolveAdLabel("source", "IG", builtIns).label).toBe("Instagram");
  });

  it("keeps the raw value for the debugging line", () => {
    const resolved = resolveAdLabel("campaign", "120249042250420301", builtIns);

    expect(resolved.raw).toBe("120249042250420301");
    expect(resolved.origin).toBe("builtin");
  });

  /**
   * The requirement this file mainly exists for: an advert created after this
   * shipped still has to read as something.
   */
  describe("a value nothing knows about", () => {
    it("prettifies a readable slug rather than looking it up", () => {
      expect(resolveAdLabel("campaign", "validation_week1", builtIns).label).toBe(
        "Validation Week 1",
      );
      expect(resolveAdLabel("creative", "ad2_new_user", builtIns).label).toBe("Ad 2 New User");
      expect(resolveAdLabel("creative", "take-a-screenshot", builtIns).label).toBe(
        "Take A Screenshot",
      );
    });

    it("does not repeat itself when the slug was already the label", () => {
      // Nothing to add on a second line, so the caller is told there is none.
      expect(resolveAdLabel("campaign", "Ramadan", builtIns).raw).toBeNull();
    });

    it("shortens a bare id but keeps two of them distinguishable", () => {
      const one = resolveAdLabel("creative", "120249042878960301", buildAdLabelIndex([]));
      const two = resolveAdLabel("creative", "120249042878960999", buildAdLabelIndex([]));

      expect(one.origin).toBe("id");
      expect(one.label).not.toBe(two.label);
      // The full id is still there for the tooltip and for Ads Manager.
      expect(one.raw).toBe("120249042878960301");
    });
  });

  it("resolves an empty value to a dash rather than blank", () => {
    expect(resolveAdLabel("campaign", null, builtIns)).toMatchObject({ label: "—", raw: null });
    expect(resolveAdLabel("campaign", "   ", builtIns).label).toBe("—");
  });
});

describe("precedence", () => {
  it("lets an admin's label beat the one shipped in code", () => {
    const index = buildAdLabelIndex(BUILT_IN_AD_LABELS, [
      { kind: "campaign", value: "120249042250420301", label: "Validation — Sept" },
    ]);

    const resolved = resolveAdLabel("campaign", "120249042250420301", index);

    expect(resolved.label).toBe("Validation — Sept");
    // And says a human chose those words, which is what the UI marks.
    expect(resolved.origin).toBe("override");
  });

  it("ignores a blank label rather than letting it erase a good one", () => {
    const index = buildAdLabelIndex(BUILT_IN_AD_LABELS, [
      { kind: "source", value: "instagram", label: "   " },
    ]);

    expect(resolveAdLabel("source", "instagram", index).label).toBe("Instagram");
  });

  it("keeps the kinds apart, so a campaign id cannot name a creative", () => {
    const index = buildAdLabelIndex([
      { kind: "campaign", value: "5550001111", label: "Spring push" },
    ]);

    expect(resolveAdLabel("campaign", "5550001111", index).label).toBe("Spring push");
    expect(resolveAdLabel("creative", "5550001111", index).origin).toBe("id");
  });
});

/**
 * The saved row has to be findable by the resolver that reads it.
 *
 * These two agree by convention and nothing enforces it at runtime: the
 * resolver lowercases its key, so a value stored with capitals is written
 * successfully, listed on the admin screen, and then silently never matches a
 * single row. A label that appears to save and does nothing is the worst shape
 * this bug could take, which is why it is pinned here.
 */
describe("what the form saves", () => {
  it("lower-cases the value so the resolver can find it", () => {
    const parsed = adLabelInputSchema.parse({
      kind: "creative",
      value: "  Take-A-Screenshot  ",
      label: "Take a Screenshot",
    });

    expect(parsed.value).toBe("take-a-screenshot");

    const index = buildAdLabelIndex([
      { kind: parsed.kind, value: parsed.value, label: parsed.label },
    ]);
    // The stored row arrives with whatever casing the advert used.
    expect(resolveAdLabel("creative", "Take-A-Screenshot", index).label).toBe("Take a Screenshot");
  });

  it("refuses a kind it has no column for", () => {
    expect(
      adLabelInputSchema.safeParse({ kind: "audience", value: "123456", label: "Lookalike" })
        .success,
    ).toBe(false);
  });

  it("refuses a blank value or a one-character label", () => {
    expect(adLabelInputSchema.safeParse({ kind: "campaign", value: "  ", label: "Ok" }).success)
      .toBe(false);
    expect(adLabelInputSchema.safeParse({ kind: "campaign", value: "123456", label: "x" }).success)
      .toBe(false);
  });
});
