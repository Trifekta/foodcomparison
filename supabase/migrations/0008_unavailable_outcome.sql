-- "We couldn't compare this one."
--
-- Until now a submission could only end one way: an admin typed a Keeta total
-- and the maths decided whether that was a saving. There was no way to record
-- the outcome that needs no total at all - the restaurant is not on Keeta, or
-- it is but this basket cannot be rebuilt there. Those submissions had nowhere
-- to go: saveComparison refused them for want of a number, so they sat in
-- 'reviewing' and the customer's page waited for an answer that never came.
--
-- This makes it a first-class ending. It is not an edge case: Keeta is newer
-- here than the apps people are ordering from, so how often this happens is
-- itself one of the more valuable things the pilot can measure.

alter table public.submissions
  drop constraint if exists submissions_status_check;

alter table public.submissions
  add constraint submissions_status_check check (
    status in (
      'new','reviewing','comparison_found','no_saving',
      'unavailable',
      'result_ready','result_sent','cancelled'
    )
  );

-- Why it could not be compared. The customer is told the same thing either
-- way; this separates a gap in Keeta's restaurant list from a gap in one
-- restaurant's menu, which are different problems with different answers.
alter table public.submissions
  add column if not exists unavailable_reason text;

alter table public.submissions
  drop constraint if exists submissions_unavailable_reason_check;

alter table public.submissions
  add constraint submissions_unavailable_reason_check check (
    unavailable_reason is null
    or unavailable_reason in ('restaurant_not_listed','items_not_available','other')
  );

-- A reason belongs only to the outcome that has one.
alter table public.submissions
  drop constraint if exists submissions_unavailable_reason_status_check;

alter table public.submissions
  add constraint submissions_unavailable_reason_status_check check (
    unavailable_reason is null or status = 'unavailable'
  );

create index if not exists submissions_unavailable_reason_idx
  on public.submissions (unavailable_reason)
  where unavailable_reason is not null;

comment on column public.submissions.unavailable_reason is
  'Why no comparison was possible. Set only when status is unavailable.';
