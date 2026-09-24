import { beforeEach, describe, expect, it, vi } from "vitest";

const stubs = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  createAdminClient: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/auth", () => ({ requireAdmin: stubs.requireAdmin }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: stubs.createAdminClient }));
vi.mock("next/cache", () => ({ revalidatePath: stubs.revalidatePath }));

const { deleteVisit } = await import("@/lib/admin/visit-actions");
const VISIT_ID = "0123456789abcdef";

beforeEach(() => {
  vi.resetAllMocks();
  stubs.requireAdmin.mockResolvedValue({ user: { id: "admin" } });
});

describe("deleteVisit", () => {
  it("never uses the service role for a non-admin or an invalid visit ID", async () => {
    stubs.requireAdmin.mockRejectedValueOnce(new Error("not an admin"));
    await expect(deleteVisit(VISIT_ID)).rejects.toThrow("not an admin");
    expect(stubs.createAdminClient).not.toHaveBeenCalled();

    expect(await deleteVisit("not-a-visit")).toEqual({
      ok: false,
      message: "That visit ID is invalid.",
    });
    expect(stubs.createAdminClient).not.toHaveBeenCalled();
  });

  it("removes only the chosen visit's IP, presence and events, then refreshes dashboards", async () => {
    const deleted: [string, string, string][] = [];
    stubs.createAdminClient.mockReturnValue({
      from: (table: string) => ({
        delete: () => ({
          eq: async (column: string, value: string) => {
            deleted.push([table, column, value]);
            return { error: null };
          },
        }),
      }),
    });

    expect(await deleteVisit(VISIT_ID)).toEqual({ ok: true });
    expect(deleted).toEqual([
      ["visitor_ips", "visit_id", VISIT_ID],
      ["visit_presence", "visit_id", VISIT_ID],
      ["funnel_events", "visit_id", VISIT_ID],
    ]);
    expect(stubs.revalidatePath).toHaveBeenCalledWith("/admin/live/visits");
    expect(stubs.revalidatePath).toHaveBeenCalledWith("/admin/live");
    expect(stubs.revalidatePath).toHaveBeenCalledWith("/admin/analytics");
  });

  it("keeps the history row visible for a retry when a supporting delete fails", async () => {
    const deleted: string[] = [];
    stubs.createAdminClient.mockReturnValue({
      from: (table: string) => ({
        delete: () => ({
          eq: async () => {
            deleted.push(table);
            return { error: table === "visit_presence" ? { message: "database unavailable" } : null };
          },
        }),
      }),
    });

    expect(await deleteVisit(VISIT_ID)).toMatchObject({ ok: false });
    expect(deleted).toEqual(["visitor_ips", "visit_presence"]);
    expect(stubs.revalidatePath).not.toHaveBeenCalled();
  });
});
