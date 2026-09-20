import { describe, expect, it } from "vitest";
import { FOOD_APPS } from "@/lib/customer/food-apps";

/**
 * The four tiles that send a customer away to build a cart.
 *
 * Every entry here is a link off our own site with a brand's name and colour
 * on it, which is the shape of a phishing tile; and every entry is also the
 * only route out of an empty upload step. So the two things worth holding are
 * that the destinations stay https and stay the brands' own, and that a tile
 * can never come out blank - the logo file is allowed to be missing, the
 * letter behind it is not.
 */

describe("the apps a cart can come from", () => {
  it("covers the four apps the upload step names", () => {
    expect(FOOD_APPS.map((app) => app.name)).toEqual([
      "Talabat",
      "Careem",
      "Deliveroo",
      "Noon Food",
    ]);
  });

  it("sends people off over https, never a custom scheme", () => {
    for (const app of FOOD_APPS) {
      expect(new URL(app.href).protocol, app.name).toBe("https:");
    }
  });

  it("gives every app a mark to fall back to when its icon is missing", () => {
    for (const app of FOOD_APPS) {
      expect([...app.mark], `${app.name} needs exactly one fallback character`).toHaveLength(1);
      expect(app.tile, app.name).toMatch(/^bg-/);
      expect(app.ink, app.name).toMatch(/^text-/);
    }
  });

  it("points each logo at its own file under /brands", () => {
    const logos = FOOD_APPS.map((app) => app.logo);
    expect(new Set(logos).size).toBe(logos.length);
    for (const logo of logos) {
      expect(logo).toMatch(/^\/brands\/[a-z0-9-]+\.(png|svg|webp)$/);
    }
  });
});
