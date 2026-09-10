-- The customer now confirms what they are ordering before we compare it.
--
-- Two things arrive from the new step: the restaurant the basket is from
-- (required), and an optional list of items. Both exist so an admin can rebuild
-- the basket on the comparison app without having to read every detail off a
-- screenshot that may be cropped.

-- The restaurant as the CUSTOMER stated it. Distinct from submissions.
-- restaurant_found, which is what the ADMIN located on the comparison app.
--
-- Nullable so the migration is safe on rows created before this step existed;
-- the application requires it for every new submission.
alter table public.submissions
  add column if not exists restaurant_name text;

alter table public.submissions
  drop constraint if exists submissions_restaurant_name_not_blank;
alter table public.submissions
  add constraint submissions_restaurant_name_not_blank
  check (restaurant_name is null or length(btrim(restaurant_name)) > 0);

-- ---------------------------------------------------------------------------
-- submission_items
-- Optional. A submission with no rows here is complete and comparable - the
-- cart screenshot is still the source of truth.
-- ---------------------------------------------------------------------------
create table if not exists public.submission_items (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,
  name          text not null,
  quantity      integer not null default 1,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  constraint submission_items_name_not_blank check (length(btrim(name)) > 0),
  constraint submission_items_quantity_range check (quantity between 1 and 99)
);

create index if not exists submission_items_submission_idx
  on public.submission_items (submission_id, sort_order);

-- ---------------------------------------------------------------------------
-- Row Level Security, matching the rest of the schema: admins only. Customers
-- never read these; their items are written by the server route using the
-- service role, which bypasses RLS.
-- ---------------------------------------------------------------------------
alter table public.submission_items enable row level security;

drop policy if exists "submission_items_admin_select" on public.submission_items;
create policy "submission_items_admin_select" on public.submission_items
  for select to authenticated using (public.is_admin());

drop policy if exists "submission_items_admin_insert" on public.submission_items;
create policy "submission_items_admin_insert" on public.submission_items
  for insert to authenticated with check (public.is_admin());

revoke all on public.submission_items from anon;
