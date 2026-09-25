import { expect, it, vi } from "vitest";
import { groupVisitors } from "@/lib/calculations/visits";

vi.mock("server-only", () => ({}));
const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: createClient }));

import { getVisitorIps } from "@/lib/admin/queries";

it("loads the browser evidence needed to count repeat visits once", async () => {
  const stored = ["aaaaaaaaaaaaaaaa", "bbbbbbbbbbbbbbbb"].map((visit_id, i) => ({
    visit_id,
    client_ip: "203.0.113.5",
    user_agent: "Safari/iPhone",
    created_at: `2026-09-25T10:0${i}:00.000Z`,
    submissions: null,
  }));
  let columns = "";
  const query = {
    select: (value: string) => { columns = value; return query; },
    gte: () => query,
    lte: () => query,
    order: async () => ({
      data: stored.map((row) => ({
        ...row,
        user_agent: columns.split(",").map((s) => s.trim()).includes("user_agent")
          ? row.user_agent : undefined,
      })),
      error: null,
    }),
  };
  createClient.mockResolvedValue({ from: () => query });

  const rows = await getVisitorIps({ from: "2026-09-25", to: "2026-09-25" });
  const groups = groupVisitors(rows.map((row) => ({
    visitId: row.visit_id,
    clientIp: row.client_ip,
    userAgent: row.user_agent,
    firstSeen: row.created_at,
    lastSeen: row.created_at,
    reference: null,
  })));

  expect(groups).toHaveLength(1);
  expect(groups[0].visitIds).toHaveLength(2);
});
