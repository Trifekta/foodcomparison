import { describe, expect, it } from "vitest";
import {
  adminSectionLabel,
  normaliseAdminPath,
  summariseAdminActivity,
  SIGN_IN_PATH,
  type AdminActivityRow,
} from "@/lib/analytics/admin-activity";

/**
 * The admin usage log.
 *
 * Two rules worth pinning, both of which are about what the log must NOT
 * become: a browsing history over customer records (normaliseAdminPath), and a
 * transcript of what a left-open tab did by itself (the background poll, and
 * the request-level collapsing the table's unique key provides).
 */

const row = (
  overrides: Partial<AdminActivityRow> & Pick<AdminActivityRow, "admin_id" | "path">,
): AdminActivityRow => ({
  day: "2026-09-22",
  first_seen_at: "2026-09-22T05:02:00.000Z",
  last_seen_at: "2026-09-22T05:02:00.000Z",
  hits: 1,
  admin_profiles: { display_name: "Ops" },
  ...overrides,
});

describe("normaliseAdminPath", () => {
  it("keeps a section path as it is", () => {
    expect(normaliseAdminPath("/admin/live")).toBe("/admin/live");
    expect(normaliseAdminPath("/admin")).toBe("/admin");
  });

  it("ignores anything outside the dashboard", () => {
    expect(normaliseAdminPath("/compare")).toBeNull();
    expect(normaliseAdminPath("/")).toBeNull();
    expect(normaliseAdminPath(null)).toBeNull();
    expect(normaliseAdminPath("")).toBeNull();
  });

  /** "/administrators" starts with "/admin" and is not the dashboard. */
  it("does not mistake a longer word for the admin root", () => {
    expect(normaliseAdminPath("/administrators")).toBeNull();
  });

  /**
   * The rule this table's privacy rests on: which SECTIONS somebody used, never
   * which customers they looked at.
   */
  it("collapses a record id so the log cannot become a browsing history", () => {
    expect(normaliseAdminPath("/admin/submissions/0f9b2c1d-4e5a-4b6c-8d7e-9f0a1b2c3d4e")).toBe(
      "/admin/submissions/:id",
    );
    expect(normaliseAdminPath("/admin/submissions/41")).toBe("/admin/submissions/:id");
    expect(normaliseAdminPath("/admin/submissions/a1b2c3d4e5f6")).toBe("/admin/submissions/:id");
  });

  it("drops the query string, which is where a customer's details would be", () => {
    expect(normaliseAdminPath("/admin?search=0501234567&status=new")).toBe("/admin");
    expect(normaliseAdminPath("/admin/live#top")).toBe("/admin/live");
  });

  it("treats a trailing slash as the same section", () => {
    expect(normaliseAdminPath("/admin/live/")).toBe("/admin/live");
    expect(normaliseAdminPath("/admin/")).toBe("/admin");
  });

  /**
   * The chime polls this every few seconds from whichever page is open, so a
   * tab left open overnight would otherwise read as somebody working all night.
   */
  it("does not record the background poll as somebody using the dashboard", () => {
    expect(normaliseAdminPath("/admin/new-visits?since=2026-09-22T05:00:00Z")).toBeNull();
  });

  it("refuses to store an unbounded path", () => {
    const long = `/admin/${"x".repeat(500)}`;
    expect(normaliseAdminPath(long)!.length).toBeLessThanOrEqual(120);
  });
});

describe("adminSectionLabel", () => {
  it("names the sections the nav names", () => {
    expect(adminSectionLabel("/admin/live")).toBe("Live");
    expect(adminSectionLabel(SIGN_IN_PATH)).toBe("Signed in");
  });

  /** A page that ships before anybody labels it still appears in the log. */
  it("falls back to the path for a section it has no name for", () => {
    expect(adminSectionLabel("/admin/something-new")).toBe("/admin/something-new");
  });
});

describe("summariseAdminActivity", () => {
  it("collapses one admin's day into a single entry spanning their sections", () => {
    const days = summariseAdminActivity([
      row({
        admin_id: "a",
        path: SIGN_IN_PATH,
        first_seen_at: "2026-09-22T05:02:00.000Z",
        last_seen_at: "2026-09-22T05:02:00.000Z",
      }),
      row({
        admin_id: "a",
        path: "/admin",
        first_seen_at: "2026-09-22T05:03:00.000Z",
        last_seen_at: "2026-09-22T14:41:00.000Z",
        hits: 12,
      }),
      row({
        admin_id: "a",
        path: "/admin/live",
        first_seen_at: "2026-09-22T06:00:00.000Z",
        last_seen_at: "2026-09-22T06:30:00.000Z",
        hits: 120,
      }),
    ]);

    expect(days).toHaveLength(1);
    expect(days[0].name).toBe("Ops");
    expect(days[0].firstSeenAt).toBe("2026-09-22T05:02:00.000Z");
    expect(days[0].lastSeenAt).toBe("2026-09-22T14:41:00.000Z");
    expect(days[0].totalHits).toBe(133);
    expect(days[0].signedIn).toBe(true);
    expect(days[0].sections.map((section) => section.path)).toEqual([
      SIGN_IN_PATH,
      "/admin",
      "/admin/live",
    ]);
  });

  it("keeps two admins on the same day apart", () => {
    const days = summariseAdminActivity([
      row({ admin_id: "a", path: "/admin", admin_profiles: { display_name: "Ops" } }),
      row({ admin_id: "b", path: "/admin", admin_profiles: { display_name: "Reviewer" } }),
    ]);

    expect(days).toHaveLength(2);
    expect(days.map((day) => day.name).sort()).toEqual(["Ops", "Reviewer"]);
  });

  /**
   * A session carried over from yesterday: the person used the dashboard, and
   * no sign-in happened to record it. Worth telling apart from a fresh day.
   */
  it("marks a day that had no sign-in of its own", () => {
    const days = summariseAdminActivity([row({ admin_id: "a", path: "/admin/live" })]);
    expect(days[0].signedIn).toBe(false);
  });

  it("shows the most recent day first", () => {
    const days = summariseAdminActivity([
      row({ admin_id: "a", path: "/admin", day: "2026-09-20" }),
      row({ admin_id: "a", path: "/admin", day: "2026-09-22" }),
      row({ admin_id: "a", path: "/admin", day: "2026-09-21" }),
    ]);

    expect(days.map((day) => day.day)).toEqual(["2026-09-22", "2026-09-21", "2026-09-20"]);
  });

  /** Times differing only in stored precision must still order by instant. */
  it("orders a day's span by the moment, not by the length of the timestamp", () => {
    const days = summariseAdminActivity([
      row({
        admin_id: "a",
        path: "/admin",
        first_seen_at: "2026-09-22T05:00:00.5Z",
        last_seen_at: "2026-09-22T05:00:00.5Z",
      }),
      row({
        admin_id: "a",
        path: "/admin/live",
        first_seen_at: "2026-09-22T05:00:00.45Z",
        last_seen_at: "2026-09-22T05:00:00.45Z",
      }),
    ]);

    expect(days[0].firstSeenAt).toBe("2026-09-22T05:00:00.45Z");
  });

  it("falls back to the admin id when a profile has no display name", () => {
    const days = summariseAdminActivity([
      row({ admin_id: "a", path: "/admin", admin_profiles: { display_name: "  " } }),
    ]);

    expect(days[0].name).toBe("a");
  });

  it("has nothing to say about a period nobody worked", () => {
    expect(summariseAdminActivity([])).toEqual([]);
  });
});
