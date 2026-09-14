-- Proving that somebody saw a comparison and then switched.
--
-- Until now the "Open on Keeta" button was an ordinary link: the customer left
-- and nothing was written down. funnel_events counted a 'keeta_opened' step,
-- but that is one anonymous row per visit with no prices in it - enough to draw
-- a funnel, useless as evidence. To say "this basket, this saving, this
-- restaurant, and then they switched" needs the numbers that were on the screen
-- at the moment of the tap, kept beside the tap.
--
-- Two things are added: an opaque token that addresses the redirect, and a row
-- per click.

-- ---------------------------------------------------------------------------
-- The public redirect token
-- ---------------------------------------------------------------------------
-- Deliberately not the result token. That one is the whole of the authorisation
-- for the result page - possession of it is possession of the customer's
-- prices - and the redirect URL is the one address in this product designed to
-- be followed off-site, where it lands in another app's referrer header and in
-- whatever sits between. A separate token means a leaked /go/ link reveals
-- nothing and grants nothing: the only thing it can do is redirect.
--
-- Not the submission id either, for the same reason and one more: a uuid in a
-- URL is an internal identifier handed to a third party for free.
alter table public.submissions
  add column if not exists redirect_token text;

comment on column public.submissions.redirect_token is
  'Opaque public token addressing /go/<token>. Never the result token: this one leaves the site.';

-- Existing rows get one too, so every comparison already saved keeps a working
-- button. gen_random_uuid() twice gives 32 hex characters, which is the shape
-- the application generates and validates.
update public.submissions
  set redirect_token = replace(gen_random_uuid()::text, '-', '')
                    || replace(gen_random_uuid()::text, '-', '')
  where redirect_token is null;

-- Unique rather than a primary key: the lookup is by this column on every
-- redirect, and a collision would point two comparisons at one link.
create unique index if not exists submissions_redirect_token_idx
  on public.submissions (redirect_token);

-- ---------------------------------------------------------------------------
-- The clicks
-- ---------------------------------------------------------------------------
-- One row per tap, not one per customer. A person who taps, reads the Keeta
-- page, comes back and taps again is two clicks and one visit, and both numbers
-- are worth having - the second is the honest denominator for "did they
-- switch", the first says how much hesitation there was.
--
-- The prices are copied in rather than joined out to the submission. They are
-- evidence of what was on the screen when the customer decided, and an admin
-- correcting a total next week must not silently rewrite last week's proof.
create table if not exists public.keeta_clicks (
  id            uuid primary key default gen_random_uuid(),

  -- The human-sized identifier, for a report somebody reads out loud.
  click_ref     text not null unique,

  -- Never cascades to null: a click whose comparison was deleted is a click
  -- that cannot be interpreted, so it goes with it.
  submission_id uuid not null references public.submissions(id) on delete cascade,

  clicked_at    timestamptz not null default now(),

  -- What this is, said plainly, so a later event type in the same table cannot
  -- be mistaken for this one.
  event         text not null default 'switch_to_keeta_clicked',

  -- ---- who ---------------------------------------------------------------
  -- The funnel's own visit id: 16-32 hex characters, made in the browser, kept
  -- for one tab, belongs to nobody. It is what separates unique switchers from
  -- total taps. Null when the browser had storage switched off.
  visit_id      text,

  -- ---- what they were looking at -----------------------------------------
  restaurant_name   text,
  -- Keeta's own id for the restaurant or branch, when there is one to have.
  -- Nothing produces it yet; the column exists so that the day a link carries
  -- one, recording it is not a migration.
  restaurant_ref    text,
  source_app        text,
  area_id           uuid references public.areas(id) on delete set null,
  area_name         text,

  current_total     numeric(10, 2),
  comparison_total  numeric(10, 2),
  saving_amount     numeric(10, 2),
  saving_percentage integer,
  -- Whether the screen said Keeta was cheaper. Stored rather than derived,
  -- because "was this a win" is the question the whole report is built on and
  -- recomputing it from two nullable numbers invites the answer to drift.
  keeta_cheaper     boolean,

  -- ---- where they went ---------------------------------------------------
  -- The URL actually redirected to, after validation. A record that stored the
  -- intended link rather than the delivered one would not be evidence.
  destination_url   text not null,

  -- ---- how they got here -------------------------------------------------
  -- Request metadata that already exists on the wire. No address, no name, no
  -- number: this feature collects nothing about a person that the product was
  -- not already handed.
  user_agent        text,
  referrer          text,
  utm_source        text,
  utm_medium        text,
  utm_campaign      text,
  campaign_id       text,

  -- ---- what became of it -------------------------------------------------
  -- A click is not an order. Keeta tells us nothing today, so every row starts
  -- at 'unknown' rather than at 'clicked': 'clicked' would imply we had looked
  -- and found no order, and we have not looked. The remaining columns are the
  -- shape a referral callback would fill in, present now so that adding one
  -- later is a route and not a schema change.
  conversion_status text not null default 'unknown'
    check (conversion_status in ('clicked', 'converted', 'not_converted', 'unknown')),
  converted_at      timestamptz,
  keeta_order_id    text,
  order_value       numeric(10, 2),
  commission_value  numeric(10, 2)
);

comment on table public.keeta_clicks is
  'Keeta click-through / switch intent. NOT a confirmed order - see conversion_status.';

-- The report groups by comparison and orders by time; the dashboard counts
-- clicks per submission on every load.
create index if not exists keeta_clicks_submission_idx
  on public.keeta_clicks (submission_id, clicked_at desc);

create index if not exists keeta_clicks_clicked_at_idx
  on public.keeta_clicks (clicked_at desc);

-- Counting unique switchers is a distinct over this column inside a date range.
create index if not exists keeta_clicks_visit_idx
  on public.keeta_clicks (visit_id)
  where visit_id is not null;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- The same posture as every other table here: anon has no policy at all, so
-- the table is unreachable from outside. The redirect route writes with the
-- service role, exactly as /api/events does, because the customer clicking is
-- not signed in to anything.
alter table public.keeta_clicks enable row level security;

drop policy if exists "keeta_clicks_admin_select" on public.keeta_clicks;
create policy "keeta_clicks_admin_select" on public.keeta_clicks
  for select to authenticated using (public.is_admin());

-- Updating is how a future referral callback marks a conversion, and an admin
-- correcting a status by hand is the manual version of the same thing.
drop policy if exists "keeta_clicks_admin_update" on public.keeta_clicks;
create policy "keeta_clicks_admin_update" on public.keeta_clicks
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
