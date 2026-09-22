-- Separate audit trail for IP validation.
--
-- This table is admin-only and exists purely for validation: proving to
-- partners like Keeta that visits are real traffic from real devices, not
-- simulated or fabricated. It is not part of the funnel analysis, which stays
-- anonymous, and it is only written to when an IP audit flag is set (either
-- in the client request or in an admin setting).
--
-- No row-level security needed: this is created empty and only admins write
-- to it via direct SQL or admin routes. Public never touches it.

create table if not exists public.visitor_ips (
  id            bigserial primary key,
  created_at    timestamptz not null default now(),

  -- The visit this IP appeared in. Nullable because the IP might arrive before
  -- the visit_id is known (though in practice it arrives with the first event).
  visit_id      text,

  -- The visitor's source IP, from x-forwarded-for header.
  -- IPv4 or IPv6, whatever the reverse proxy sends. No anonymization or
  -- truncation: the whole thing is what validates that the traffic is real.
  client_ip     text not null,

  -- Optional: if this visit ended in an order, the submission id it created.
  -- Null for visits that abandoned. Indexed so Keeta's validation export
  -- can join to orders without a full table scan.
  submission_id uuid references public.submissions (id) on delete set null,

  constraint visitor_ips_visit_shape check (visit_id is null or visit_id ~ '^[0-9a-f]{16,32}$'),
  -- One row per visit: upsert on visit_id so only the first IP is recorded.
  unique (visit_id)
);

-- Fast lookup by visit_id for validation reports.
create index if not exists visitor_ips_visit_id_idx
  on public.visitor_ips (visit_id);

-- Fast lookup by submission_id so Keeta can fetch validation data per order.
create index if not exists visitor_ips_submission_id_idx
  on public.visitor_ips (submission_id);

-- Time-based queries for daily/weekly validation exports.
create index if not exists visitor_ips_created_idx
  on public.visitor_ips (created_at desc);

-- Admin-only. No other policies needed.
alter table public.visitor_ips enable row level security;

drop policy if exists "visitor_ips_admin_select" on public.visitor_ips;
create policy "visitor_ips_admin_select" on public.visitor_ips
  for select to authenticated using (public.is_admin());

comment on table public.visitor_ips is
  'IP addresses for validation: proving visits are real traffic from real devices. Admin-only, separate from funnel analytics which stay anonymous.';
comment on column public.visitor_ips.client_ip is
  'The x-forwarded-for IP. Real visits have real IPs; this table exists to prove that to partners like Keeta.';
