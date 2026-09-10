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

const { getAdminSession, requireAdmin } = await import("@/lib/supabase/auth");

beforeEach(() => {
  getUser.mockReset();
  maybeSingle.mockReset();
  redirect.mockClear();
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
