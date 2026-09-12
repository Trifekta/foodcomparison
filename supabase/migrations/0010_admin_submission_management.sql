-- Managing a submission after it has arrived, and counting the screen before
-- the wizard.
--
-- Numbered 0010 rather than 0009. Two branches both wrote a 0009 - this one and
-- 0009_funnel_events.sql - and git merged them without complaint because the
-- filenames differ. Two migrations claiming one number is an ordering nobody
-- can rely on, so this one moved.
--
-- Three things the dashboard could not do. A test submission, a duplicate from
-- somebody who tapped twice, a basket typed wrong by the customer - each of
-- them sat in the list forever, counted in the validation metrics, and could
-- only be nudged sideways into 'cancelled'.

-- ---------------------------------------------------------------------------
-- Archive
-- ---------------------------------------------------------------------------
-- A timestamp rather than a boolean: "when did this leave the list" is a
-- question worth being able to answer, and it costs the same column.
--
-- Archiving is not a status. A submission that is archived still has whatever
-- status it reached - result_sent, unavailable, new - and the two are read
-- together. Folding it into the status enum would have meant losing the
-- outcome the moment somebody tidied the list, which is exactly the row the
-- validation metrics need.
alter table public.submissions
  add column if not exists archived_at timestamptz;

comment on column public.submissions.archived_at is
  'When an admin archived this submission. Null means it is in the working list.';

-- The dashboard filters on this on every page load, and archived rows are the
-- minority, so a partial index over the live ones is the one that gets used.
create index if not exists submissions_archived_idx
  on public.submissions (archived_at)
  where archived_at is null;

-- ---------------------------------------------------------------------------
-- Delete
-- ---------------------------------------------------------------------------
-- 0002 deliberately left submissions with no delete policy - "submissions are
-- cancelled, not removed". That was right while cancelling was the only way to
-- get a row out of the way. Now that archiving exists to do that job without
-- losing anything, the remaining reason to delete is the one archiving cannot
-- serve: a customer asking for their data to be removed, and the test rows that
-- should never have counted.
--
-- So the policy is added rather than the rule being worked around with the
-- service role. RLS stays the final authority on what an admin may do, which is
-- the property the rest of this schema is built on.
--
-- submission_items, submission_events and submission_extractions already
-- cascade from submissions, so the row takes its history with it. Stored
-- screenshots do not - nothing in Postgres knows about the bucket - so the
-- action deletes those first and the column is nulled if it cannot.
drop policy if exists "submissions_admin_delete" on public.submissions;
create policy "submissions_admin_delete" on public.submissions
  for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- New audit events
-- ---------------------------------------------------------------------------
-- 'submission_deleted' is deliberately absent: the events cascade away with the
-- row, so an event recording its own deletion would delete itself. A deletion
-- that needs to be provable belongs in an append-only log that outlives the
-- submission, which this table is not.
alter table public.submission_events
  drop constraint if exists submission_events_type_check;

alter table public.submission_events
  add constraint submission_events_type_check check (
    event_type in (
      'submission_created','review_started','comparison_added',
      'status_changed','result_generated','result_sent',
      'submission_edited','submission_archived','submission_unarchived'
    )
  );


-- ---------------------------------------------------------------------------
-- The landing page, as a funnel step
-- ---------------------------------------------------------------------------
-- 0009_funnel_events.sql starts counting at 'wizard_started', which fires when
-- the upload screen appears. That misses the drop that matters most to a paid
-- campaign: the people who arrive from the advert, look at the landing page and
-- leave without ever starting. Without it there is no telling an advert that
-- brings the wrong people from a first screen that loses the right ones.
--
-- Added here rather than by editing 0009, because a migration that may already
-- have been applied somewhere is not a file to rewrite.
alter table public.funnel_events
  drop constraint if exists funnel_events_event_check;

alter table public.funnel_events
  add constraint funnel_events_event_check check (
    event in (
      'landing_viewed',
      'wizard_started',
      'step_basket',
      'step_where',
      'step_review',
      'submitted',
      'result_viewed',
      'keeta_opened'
    )
  );
