-- The customer's own result page.
--
-- Until now a submission had no customer-readable address at all: the
-- confirmation screen echoed a reference number and looked nothing up, because
-- FFA-260910-0042 is a date plus four random digits - ten thousand possibilities
-- a day, walkable in seconds. That was the right call for a page that shows
-- nothing, and it is exactly why the reference cannot become the key to a page
-- that shows a price, a basket and a saving.
--
-- So a submission gets a second identifier: 16 random bytes, unguessable, and
-- never printed anywhere except the link we send its owner. The reference number
-- stays what it always was - the human handle people quote in a WhatsApp reply.
--
-- No RLS policy accompanies this. The result page is rendered on the server,
-- which looks the token up with the service role and projects the row down to
-- the handful of fields a customer may see; the anon role still cannot read this
-- table at all.

alter table public.submissions
  add column if not exists result_token text;

-- Rows created before this column existed still need an address.
update public.submissions
  set result_token = encode(gen_random_bytes(16), 'hex')
  where result_token is null;

-- A default as well as application code: a submission with no token would be
-- one nobody could ever be shown, and that must not depend on a caller
-- remembering.
alter table public.submissions
  alter column result_token set default encode(gen_random_bytes(16), 'hex');

alter table public.submissions
  alter column result_token set not null;

create unique index if not exists submissions_result_token_key
  on public.submissions (result_token);

-- Where the rebuilt basket lives on the comparison app, pasted by the admin
-- from the page they are already looking at while they rebuild it. It becomes
-- the button at the bottom of the customer's result.
alter table public.submissions
  add column if not exists comparison_url text;

comment on column public.submissions.result_token is
  'Unguessable address for the customer result page. Never logged, never listed.';
comment on column public.submissions.comparison_url is
  'Public link to the rebuilt basket''s restaurant page on the comparison app.';
