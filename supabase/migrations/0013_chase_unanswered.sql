-- Remembering that somebody has already been nudged about a submission.
--
-- The product promises a result in about five minutes, and the whole thing
-- depends on a person noticing an order arrived. The arrival alert fires once;
-- if it is missed - phone face down, Telegram muted, the admin walking into a
-- restaurant - nothing ever says so again, and the customer waits out a promise
-- nobody is keeping.
--
-- A timestamp rather than a boolean, so "how long did it sit before anybody was
-- reminded" is answerable later, and so the chaser can decide to nudge a second
-- time after a longer gap without another column.
alter table public.submissions
  add column if not exists chased_at timestamptz;

comment on column public.submissions.chased_at is
  'When an admin was last reminded this submission is still unanswered.';

-- The chaser asks one question on a schedule: which new submissions are older
-- than the promise and have not been chased. A partial index over exactly that
-- set keeps it cheap however large the table grows, because the rows it has to
-- consider are only ever the handful currently waiting.
create index if not exists submissions_unanswered_idx
  on public.submissions (created_at)
  where status = 'new' and chased_at is null and archived_at is null;
