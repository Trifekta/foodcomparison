import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Admin authorisation.
 *
 * Being signed in is not enough: the account must also have an admin_profiles
 * row. These tests pin that rule, which is the same one the RLS policies use.
 */

const getUser = vi.fn();
const maybeSingle = vi.fn();

const supabaseStub = {
  auth: { getUser },
  from: () => ({
    select: () => ({
      eq: () => ({ maybeSingle }),
    }),
  }),
};

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => supabaseStub,
}));

const redirect = vi.fn((path: string) => {
  throw new Error(`REDIRECT:${path}`);
});

vi.mock("next/navigation", () => ({ redirect }));

// requireAdmin() also records that an admin used the dashboard, which needs the
// request the proxy annotated and a service-role write. Both are stubbed: what
// is under test here is who gets through, and separately that getting through
// is what triggers the record.
const recordAdminUse = vi.fn(async () => {});
vi.mock("@/lib/admin/activity", () => ({ recordAdminUse }));

const requestHeaders = new Headers();
vi.mock("next/headers", () => ({ headers: async () => requestHeaders }));

const { getAdminSession, requireAdmin } = await import("@/lib/supabase/auth");

beforeEach(() => {
  getUser.mockReset();
  maybeSingle.mockReset();
  redirect.mockClear();
  recordAdminUse.mockClear();
  requestHeaders.set("x-admin-path", "/admin/live");
});

describe("getAdminSession", () => {
  it("returns null when nobody is signed in", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect(await getAdminSession()).toBeNull();
  });

  it("returns null for a signed-in user with no admin profile", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1", email: "a@example.com" } } });
    maybeSingle.mockResolvedValue({ data: null });

    expect(await getAdminSession()).toBeNull();
  });

  it("returns the session for a signed-in admin", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1", email: "a@example.com" } } });
    maybeSingle.mockResolvedValue({
      data: { id: "user-1", display_name: "Ops", role: "admin", created_at: "2026-09-10" },
    });

    const session = await getAdminSession();
    expect(session?.profile.role).toBe("admin");
    expect(session?.user.id).toBe("user-1");
  });
});

describe("requireAdmin", () => {
  it("redirects an anonymous visitor to the login page", async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    await expect(requireAdmin()).rejects.toThrow("REDIRECT:/admin/login");
  });

  it("keeps the intended destination so the admin lands where they meant to", async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    await expect(requireAdmin("/admin/submissions/abc")).rejects.toThrow(
      "REDIRECT:/admin/login?next=%2Fadmin%2Fsubmissions%2Fabc",
    );
  });

  it("redirects a signed-in non-admin rather than letting them through", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-2", email: "b@example.com" } } });
    maybeSingle.mockResolvedValue({ data: null });

    await expect(requireAdmin()).rejects.toThrow("REDIRECT:/admin/login");
  });

  it("lets an admin through", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1", email: "a@example.com" } } });
    maybeSingle.mockResolvedValue({
      data: { id: "user-1", display_name: "Ops", role: "admin", created_at: "2026-09-10" },
    });

    const session = await requireAdmin();
    expect(session.user.id).toBe("user-1");
    expect(redirect).not.toHaveBeenCalled();
  });
});

/**
 * The guard is also where admin use is recorded, because it is the one thing
 * every admin page, route handler and server action already goes through.
 */
describe("requireAdmin, as the usage record", () => {
  const asAdmin = () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1", email: "a@example.com" } } });
    maybeSingle.mockResolvedValue({
      data: { id: "user-1", display_name: "Ops", role: "admin", created_at: "2026-09-10" },
    });
  };

  it("records the section an admin reached, against that admin", async () => {
    asAdmin();

    await requireAdmin();

    expect(recordAdminUse).toHaveBeenCalledWith("user-1", "/admin/live");
  });

  /** A request that was turned away is not somebody using the dashboard. */
  it("records nothing for a signed-in user with no admin profile", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-2", email: "b@example.com" } } });
    maybeSingle.mockResolvedValue({ data: null });

    await expect(requireAdmin()).rejects.toThrow("REDIRECT:/admin/login");
    expect(recordAdminUse).not.toHaveBeenCalled();
  });

  it("records nothing for an anonymous visitor", async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    await expect(requireAdmin()).rejects.toThrow("REDIRECT:/admin/login");
    expect(recordAdminUse).not.toHaveBeenCalled();
  });

  /**
   * The log must never be the reason the dashboard breaks - requireAdmin()
   * guards every admin page at once.
   */
  it("still lets the admin through when the record cannot be written", async () => {
    asAdmin();
    recordAdminUse.mockRejectedValueOnce(new Error("supabase is down"));

    const session = await requireAdmin();
    expect(session.user.id).toBe("user-1");
  });
});
