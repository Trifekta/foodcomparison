import { describe, expect, it } from "vitest";

import { areasMentionedIn, type MentionableArea } from "@/lib/area-mentions";

const areas: MentionableArea[] = [
  { id: "dubai-business-bay", name: "Business Bay", city: "Dubai" },
  { id: "dubai-jvc", name: "Jumeirah Village Circle", city: "Dubai" },
  { id: "dubai-al-nahda", name: "Al Nahda Dubai", city: "Dubai" },
  { id: "dubai-jbr", name: "JBR", city: "Dubai" },
  { id: "sharjah-al-nahda", name: "Al Nahda", city: "Sharjah" },
  { id: "sharjah-rolla", name: "Rolla", city: "Sharjah" },
  { id: "alain-al-jimi", name: "Al Jimi", city: "Al Ain" },
];

/** Roughly the shape tesseract returns for a cart screenshot. */
const cartText = `Talabat
Pizza Hut - Jumeirah Village Circle
Deliver to: Home
Jumeirah Village Circle, Dubai

Limo Combo
AED 133.40
Total AED 133.40`;

describe("areasMentionedIn", () => {
  it("says nothing before there is any OCR text to read", () => {
    expect(areasMentionedIn(null, areas, "dubai-business-bay")).toEqual([]);
    expect(areasMentionedIn("   ", areas, "dubai-business-bay")).toEqual([]);
    expect(areasMentionedIn(undefined, areas, "dubai-business-bay")).toEqual([]);
  });

  it("flags the area the screenshot names when the customer chose another", () => {
    const found = areasMentionedIn(cartText, areas, "dubai-business-bay");
    expect(found.map((mention) => mention.name)).toEqual(["Jumeirah Village Circle"]);
    expect(found[0]?.city).toBe("Dubai");
  });

  it("stays silent when the screenshot agrees with the customer", () => {
    expect(areasMentionedIn(cartText, areas, "dubai-jvc")).toEqual([]);
  });

  it("reports the longer name only, so one address is not two places", () => {
    // "Al Nahda" sits inside "Al Nahda Dubai"; reporting both would read as a
    // customer who is somehow in two emirates.
    const found = areasMentionedIn("Deliver to: Al Nahda Dubai", areas, "dubai-business-bay");
    expect(found.map((mention) => mention.name)).toEqual(["Al Nahda Dubai"]);
  });

  it("still finds the Sharjah one when that is what the text says", () => {
    const found = areasMentionedIn("Deliver to: Al Nahda, Sharjah", areas, "dubai-business-bay");
    expect(found.map((mention) => mention.name)).toEqual(["Al Nahda"]);
  });

  it("does not fire on a name buried inside a longer word", () => {
    // A flag that cried wolf would be ignored on the day it was right.
    expect(areasMentionedIn("Rollarama Special", areas, "dubai-business-bay")).toEqual([]);
    expect(areasMentionedIn("Item code JBRX-22", areas, "dubai-business-bay")).toEqual([]);
  });

  it("does fire on a short name standing on its own", () => {
    const found = areasMentionedIn("Deliver to: JBR, The Walk", areas, "dubai-business-bay");
    expect(found.map((mention) => mention.name)).toEqual(["JBR"]);
  });

  it("matches whatever case the OCR happened to read", () => {
    const found = areasMentionedIn("DELIVER TO: business bay", areas, "dubai-jvc");
    expect(found.map((mention) => mention.name)).toEqual(["Business Bay"]);
  });

  it("treats a hyphen as a boundary, not as part of the word", () => {
    const hyphenated: MentionableArea[] = [
      { id: "sharjah-dibba", name: "Dibba Al-Hisn", city: "Sharjah" },
    ];
    expect(
      areasMentionedIn("Deliver to: Dibba Al-Hisn", hyphenated, "dubai-jvc").map((m) => m.name),
    ).toEqual(["Dibba Al-Hisn"]);
  });

  it("names a place once even when two cities share it", () => {
    const twins: MentionableArea[] = [
      { id: "a", name: "Al Bateen", city: "Abu Dhabi" },
      { id: "b", name: "Al Bateen", city: "Al Ain" },
    ];
    expect(areasMentionedIn("Deliver to: Al Bateen", twins, "dubai-jvc")).toHaveLength(1);
  });

  it("reports several areas in a stable order", () => {
    const found = areasMentionedIn(
      "Pizza Hut Rolla branch, deliver to Al Jimi",
      areas,
      "dubai-business-bay",
    );
    expect(found.map((mention) => mention.name)).toEqual(["Al Jimi", "Rolla"]);
  });

  it("is not confused by regex characters in an area name", () => {
    const odd: MentionableArea[] = [{ id: "x", name: "Al Quoz (Industrial)", city: "Dubai" }];
    expect(areasMentionedIn("Deliver to Al Quoz (Industrial)", odd, "dubai-jvc")).toHaveLength(1);
    expect(areasMentionedIn("Al Quoz Industrial", odd, "dubai-jvc")).toEqual([]);
  });
});
