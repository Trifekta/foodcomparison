-- What people do before they become a submission.
--
-- Everything measurable so far starts at the moment somebody finishes the
-- wizard, which is the one moment we already know about. The interesting
-- question is the opposite one: of everybody who started, how many got to the
-- end, and where did the rest stop? Without it there is no way to tell an ad
-- that brings nobody from a screen that loses everybody.
--
-- Deliberately not a person. A visit id is a random value the browser makes up
-- for one visit and forgets; it exists to count "visits that reached step 3"
-- rather than "times step 3 was rendered", and it is tied to nothing - no
-- account, no contact detail, no IP, no device fingerprint. Two visits from the
-- same phone are two visits, which is the honest answer for a funnel and the
-- one that keeps this out of personal-data territory entirely.

create table if not exists public.funnel_events (
  id            bigserial primary key,
  created_at    timestamptz not null default now(),

  -- One of the known steps. Unknown names are rejected rather than stored, so
  -- a typo in the client cannot quietly create a category nobody notices.
  event         text not null,

  -- Random per visit, from the browser. Not a user id.
  visit_id      text not null,

  -- Set only on the events that happen after an order exists, so the result
  -- page and the Keeta button can be attributed without a visit id following
  -- anybody from one device to another.
  submission_id uuid references public.submissions (id) on delete cascade,

  constraint funnel_events_event_check check (
    event in (
      'wizard_started',
      'step_basket',
      'step_where',
      'step_review',
      'submitted',
      'result_viewed',
      'keeta_opened'
    )
  ),
  constraint funnel_events_visit_shape check (visit_id ~ '^[0-9a-f]{16,32}$')
);

-- The dashboard reads a date range and groups by event.
create index if not exists funnel_events_created_idx
  on public.funnel_events (created_at desc);

create index if not exists funnel_events_event_idx
  on public.funnel_events (event, created_at desc);

-- Same rule as everything else here: admins read, nobody else touches it, and
-- the public write goes through a server route holding the service role. There
-- is deliberately no anon policy.
alter table public.funnel_events enable row level security;

drop policy if exists "funnel_events_admin_select" on public.funnel_events;
create policy "funnel_events_admin_select" on public.funnel_events
  for select to authenticated using (public.is_admin());

comment on table public.funnel_events is
  'Anonymous step counts for the customer funnel. visit_id is per visit, not per person.';
