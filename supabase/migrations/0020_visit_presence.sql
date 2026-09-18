-- Who is on the site right now, and where they last were.
--
-- funnel_events says which visits reached which step, but never when a visit
-- was last seen - a visit that opened the wizard five minutes ago and has not
-- moved since looks identical, in that table, to one still on the screen right
-- now. This is a second, much smaller thing: one row per visit, overwritten in
-- place every time that visit does anything (a real funnel step) or simply
-- stays open (a heartbeat the browser sends every twenty seconds while the tab
-- is visible - see lib/analytics/track.ts). last_seen_at is what answers "is
-- somebody still there", which is the question the admin's live view exists to
-- answer and funnel_events was never shaped to.
--
-- This table only ever answers "right now" - it has no history and needs none,
-- so unlike funnel_events it never grows. A visit that goes quiet just stops
-- being counted; nothing has to delete it.
create table if not exists public.visit_presence (
  visit_id      text primary key,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),

  -- The most recent real funnel step this visit reached. Null means a
  -- heartbeat arrived before any step did, which happens when the landing
  -- page's own beacon is still in flight - a visit that has been seen but has
  -- not said anything about itself yet, which is a real state and not an
  -- error.
  last_event    text,

  -- Set once a visit's order exists, same as on funnel_events, so the live
  -- view can name a reference number instead of just a visit id.
  submission_id uuid references public.submissions (id) on delete set null,
  area_id       uuid references public.areas (id) on delete set null,

  constraint visit_presence_visit_shape check (visit_id ~ '^[0-9a-f]{16,32}$')
);

-- The live view's whole query: "seen since X", newest first.
create index if not exists visit_presence_last_seen_idx
  on public.visit_presence (last_seen_at desc);

-- Same rule as funnel_events: admins read, nobody else touches it, and the
-- public write goes through a server route holding the service role.
alter table public.visit_presence enable row level security;

drop policy if exists "visit_presence_admin_select" on public.visit_presence;
create policy "visit_presence_admin_select" on public.visit_presence
  for select to authenticated using (public.is_admin());

comment on table public.visit_presence is
  'Latest-seen per visit, for the admin "who is on the site now" view. Overwritten in place, not a history - see funnel_events for that.';
