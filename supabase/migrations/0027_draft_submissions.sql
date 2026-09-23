-- Draft submissions: temporary wizard state persistence for mobile reloads
--
-- When a customer picks a screenshot and progresses through the wizard, their
-- state (form values, items, screenshot path) is stored server-side so a reload
-- or in-app browser context loss does not require re-uploading.
--
-- Screenshots are stored in temporary draft paths and cleaned up after 24 hours
-- unless the draft is submitted. On submission, the draft is converted to a
-- full submission and the temporary files are deleted.

create table if not exists public.draft_submissions (
  id                    uuid primary key default gen_random_uuid(),

  -- The visit this draft belongs to. Used to reconnect after reload.
  -- Ties this draft to analytics visit_id for attribution.
  visit_id              text not null,

  -- Where the customer left off in the wizard.
  -- 1 = upload screen, 2 = confirm screen
  wizard_step           integer not null,

  -- Serialized form state: restaurantName, currentTotal, areaId, etc.
  -- Includes items array, autofilled tracking.
  wizard_state_json     jsonb not null,

  -- Storage paths to the screenshot files. May be null if picked but not yet stored.
  -- Stored in private bucket under drafts/ prefix for cleanup.
  cart_image_path       text,
  checkout_image_path   text,

  -- When this draft was created
  created_at            timestamptz not null default now(),

  -- When this draft expires and should be cleaned up
  -- 24 hours from creation by default
  expires_at            timestamptz not null,

  -- Track if this draft has been submitted (soft delete)
  -- Prevents re-use of draft if customer submits, returns, tries to submit again
  submitted_at          timestamptz,

  constraint draft_submissions_visit_shape check (
    visit_id ~ '^[0-9a-f]{16,32}$'
  ),
  constraint draft_submissions_step_valid check (
    wizard_step in (1, 2)
  )
);

create index if not exists draft_submissions_visit_id_idx
  on public.draft_submissions (visit_id desc);

create index if not exists draft_submissions_expires_at_idx
  on public.draft_submissions (expires_at asc);

create index if not exists draft_submissions_created_at_idx
  on public.draft_submissions (created_at desc);

-- Add visit_id to submissions table for attribution and linking
alter table public.submissions
  add column if not exists visit_id text;

-- Index for linking submissions back to visits
create index if not exists submissions_visit_id_idx
  on public.submissions (visit_id);

-- RLS: Only admins can read drafts (same as funnel_events)
alter table public.draft_submissions enable row level security;

drop policy if exists "draft_submissions_admin_select" on public.draft_submissions;
create policy "draft_submissions_admin_select" on public.draft_submissions
  for select to authenticated using (public.is_admin());

comment on table public.draft_submissions is
  'Temporary wizard state for mobile reload resilience. Auto-cleaned after 24 hours.';
comment on column public.draft_submissions.visit_id is
  'Analytics visit_id for attribution. Anonymous, not tied to person.';
