-- What the team does, as opposed to what customers do.
--
-- Everything measured so far is deliberately anonymous: funnel_events counts
-- visits that belong to nobody, and visit_presence forgets them the moment they
-- go quiet. This table is the opposite kind of record on purpose. The people in
-- it are named, signed in, and accountable - which is the whole reason it
-- exists. "Was the dashboard opened today, by whom, and which part of it did
-- they actually use" is a question the admin side could not answer at all:
-- submission_events records what an admin CHANGED, so an admin who signed in,
-- read every new order and changed nothing left no trace whatsoever.
--
-- One row per admin per section per Dubai day, not one row per request.
--
-- Per request would be the obvious shape and it is the wrong one here. The live
-- view refreshes itself every fifteen seconds and the new-visit chime polls
-- behind whichever page is open, so an append-only log would be almost entirely
-- machine traffic - hundreds of rows a day saying nothing except that a tab was
-- left open. Collapsed this way, that same tab is one row whose hits climb and
-- whose last_seen_at moves, and the interesting facts (which sections were
-- opened at all, when the day started, when it ended) are what is left.
--
-- The Dubai day rather than a rolling window, for the same reason visit ids
-- carry one: every window the dashboard offers is a Dubai calendar day, and a
-- row that straddled midnight would appear under both of them.
create table if not exists public.admin_activity (
  id            bigserial primary key,

  -- Who. Named, and cascaded away with the profile - a removed admin's history
  -- goes with them rather than pointing at an id nobody can resolve.
  admin_id      uuid not null references public.admin_profiles (id) on delete cascade,

  -- The Dubai calendar day this row covers, YYYY-MM-DD.
  day           date not null,

  -- Which part of the dashboard, already normalised by the caller: a section
  -- path such as '/admin/live', with dynamic segments collapsed ('/admin/
  -- submissions/:id') and query strings dropped. See lib/admin/activity.ts -
  -- storing the raw URL instead would make one row per submission opened and
  -- turn a section log into a browsing history.
  path          text not null,

  -- The first and last time this admin touched this section on this day. The
  -- pair is what answers "when did they use it" now that individual requests
  -- are not kept: the span, not the moment.
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),

  -- Server requests, NOT page views, and the difference is worth stating
  -- because nothing in the number itself admits it. An auto-refreshing page
  -- adds four a minute on its own, and one navigation can add more than one.
  -- It is an honest measure of how heavily a section was hit and a dishonest
  -- measure of how many times somebody looked at it.
  hits          integer not null default 1,

  -- One row per admin per section per day is the whole point; the upsert in
  -- record_admin_activity() keys off exactly this.
  unique (admin_id, day, path)
);

-- The view reads a day (or a short range) and shows the most recent first.
create index if not exists admin_activity_day_idx
  on public.admin_activity (day desc, last_seen_at desc);

-- "Everything this person did", which is the other way the log gets read.
create index if not exists admin_activity_admin_idx
  on public.admin_activity (admin_id, day desc);

/**
 * The upsert, as one atomic statement.
 *
 * hits has to be read and written to be incremented, and doing that from the
 * application would be a read followed by a write with a gap in the middle -
 * two admins on the dashboard at once, or one admin with two tabs, would land
 * in that gap and lose counts. ON CONFLICT DO UPDATE does it in a single
 * statement under the unique index, so concurrent callers queue instead of
 * overwriting each other.
 *
 * first_seen_at is deliberately absent from the UPDATE: it is written once, by
 * the INSERT that created the row, and never touched again. That is what makes
 * it mean "when this admin first opened this section today" rather than
 * "recently".
 */
create or replace function public.record_admin_activity(
  p_admin_id uuid,
  p_day      date,
  p_path     text
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.admin_activity (admin_id, day, path)
  values (p_admin_id, p_day, p_path)
  on conflict (admin_id, day, path) do update
    set last_seen_at = now(),
        hits         = admin_activity.hits + 1;
$$;

-- Callable by the service role alone, which is the only thing that calls it
-- (lib/admin/activity.ts). Not granted to `authenticated` on purpose: the
-- function takes the admin id as an argument, so an admin who could call it
-- directly could write rows in a colleague's name - and an audit trail its
-- subjects can forge is not one.
revoke all on function public.record_admin_activity(uuid, date, text) from public;
grant execute on function public.record_admin_activity(uuid, date, text) to service_role;

-- Admins read the log; nothing writes to it except the service role, exactly
-- like funnel_events and visitor_ips. There is deliberately no insert, update
-- or delete policy at all - not even for admins. A record of who used the
-- dashboard that a dashboard user could edit or delete would be worthless.
alter table public.admin_activity enable row level security;

drop policy if exists "admin_activity_admin_select" on public.admin_activity;
create policy "admin_activity_admin_select" on public.admin_activity
  for select to authenticated using (public.is_admin());

comment on table public.admin_activity is
  'Who used the admin dashboard, which sections, and when. One row per admin per section per Dubai day. Admins read it; only the service role writes it.';
comment on column public.admin_activity.hits is
  'Server requests, not page views: auto-refreshing pages and background polls inflate it. Use it to rank sections, never to count visits.';
comment on column public.admin_activity.path is
  'Normalised section path, dynamic segments collapsed to :id. Never a raw URL.';
