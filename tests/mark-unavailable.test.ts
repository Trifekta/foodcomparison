import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Recording a basket that could not be priced.
 *
 * The point of this outcome is that it has no number in it. What matters is
 * therefore what it does NOT write: a comparison total or a saving here would
 * be a figure nobody checked, and every average on the dashboard reads from
 * those columns.
 */

const SUBMISSION_ID = "11111111-1111-4111-8111-111111111111";

const updates: Array<Record<string, unknown>> = [];
const events: Array<Record<string, unknown>> = [];

let submission: Record<string, unknown> | null = {
  id: SUBMISSION_ID,
  status: "reviewing",
  restaurant_name: "Mandarin Oak",
  comparison_app: "Keeta",
  result_token: "0123456789abcdef0123456789abcdef",
  source_app: "Talabat",
  source_app_other: null,
  current_total: "34.65",
};

const supabaseStub = {
  from(table: string) {
    return {
      select: () => ({
        eq: () => ({ maybeSingle: () => Promise.resolve({ data: submission, error: null }) }),
      }),
      update(values: Record<string, unknown>) {
        updates.push(values);
        return { eq: () => Promise.resolve({ error: null }) };
      },
      insert(values: Record<string, unknown>) {
        if (table === "submission_events") events.push(values);
        return Promise.resolve({ error: null });
      },
    };
  },
};

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: async () => supabaseStub,
}));
vi.mock("@/lib/supabase/auth", () => ({
  requireAdmin: async () => ({ user: { id: "admin-1" } }),
  getAdminSession: async () => ({ user: { id: "admin-1" } }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/navigation", () => ({ redirect: () => {} }));

const { markUnavailable } = await import("@/lib/admin/actions");

function form(overrides: Record<string, string> = {}): FormData {
  const body = new FormData();
  const fields = {
    submissionId: SUBMISSION_ID,
    reason: "restaurant_not_listed",
    adminNotes: "",
    ...overrides,
  };
  for (const [key, value] of Object.entries(fields)) body.append(key, value);
  return body;
}

beforeEach(() => {
  updates.length = 0;
  events.length = 0;
});

describe("markUnavailable", () => {
  it("records the outcome and the reason", async () => {
    const result = await markUnavailable(form());
    expect(result.ok).toBe(true);
    expect(updates[0]).toMatchObject({
      status: "unavailable",
      unavailable_reason: "restaurant_not_listed",
    });
  });

  it("writes no price and no saving", async () => {
    await markUnavailable(form());
    const written = updates[0];
    for (const column of ["comparison_total", "saving_amount", "saving_percentage"]) {
      expect(written, `must not touch ${column}`).not.toHaveProperty(column);
    }
  });

  it("writes the customer's message, so it sends like any other result", async () => {
    await markUnavailable(form());
    const message = String(updates[0].result_message);
    expect(message).toContain("Mandarin Oak");
    expect(message).not.toMatch(/AED\s*\d/);
  });

  it("refuses a reason that is not one of ours", async () => {
    const result = await markUnavailable(form({ reason: "because" }));
    expect(result.ok).toBe(false);
    expect(updates).toHaveLength(0);
  });

  it("refuses an id that is not an id", async () => {
    const result = await markUnavailable(form({ submissionId: "nope" }));
    expect(result.ok).toBe(false);
    expect(updates).toHaveLength(0);
  });

  it("leaves an audit trail of who closed it and why", async () => {
    await markUnavailable(form());
    const statusChange = events.find((event) => event.event_type === "status_changed");
    expect(statusChange).toMatchObject({
      previous_status: "reviewing",
      new_status: "unavailable",
      created_by: "admin-1",
    });
    expect(statusChange?.metadata).toMatchObject({ unavailable_reason: "restaurant_not_listed" });
  });

  it("does nothing for a submission that is not there", async () => {
    const previous = submission;
    submission = null;
    const result = await markUnavailable(form());
    submission = previous;

    expect(result.ok).toBe(false);
    expect(updates).toHaveLength(0);
  });
});
