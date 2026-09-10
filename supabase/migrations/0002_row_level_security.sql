-- Row Level Security.
--
-- Model:
--   * Customers are anonymous and NEVER talk to these tables. Their submission
--     goes through the server route /api/submissions, which uses the service
--     role. There is therefore no anon policy anywhere - no public listing API,
--     and a guessed reference number reveals nothing.
--   * Admins are Supabase Auth users who also have an admin_profiles row.
--   * The service role bypasses RLS by design and is server-only.

-- Security definer so policies can consult admin_profiles without recursing
-- into that table's own policies.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_profiles ap where ap.id = auth.uid()
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

alter table public.areas             enable row level security;
alter table public.submissions       enable row level security;
alter table public.submission_events enable row level security;
alter table public.admin_profiles    enable row level security;

-- areas ---------------------------------------------------------------------
-- Admin-only, because this table carries the internal test-location columns.
-- The customer wizard receives a projected {id, name} list rendered on the server.
drop policy if exists "areas_admin_select" on public.areas;
create policy "areas_admin_select" on public.areas
  for select to authenticated using (public.is_admin());

drop policy if exists "areas_admin_insert" on public.areas;
create policy "areas_admin_insert" on public.areas
  for insert to authenticated with check (public.is_admin());

drop policy if exists "areas_admin_update" on public.areas;
create policy "areas_admin_update" on public.areas
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "areas_admin_delete" on public.areas;
create policy "areas_admin_delete" on public.areas
  for delete to authenticated using (public.is_admin());

-- submissions ---------------------------------------------------------------
-- Read and write for admins only. Customers cannot browse, read or list.
drop policy if exists "submissions_admin_select" on public.submissions;
create policy "submissions_admin_select" on public.submissions
  for select to authenticated using (public.is_admin());

drop policy if exists "submissions_admin_update" on public.submissions;
create policy "submissions_admin_update" on public.submissions
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "submissions_admin_insert" on public.submissions;
create policy "submissions_admin_insert" on public.submissions
  for insert to authenticated with check (public.is_admin());

-- Deliberately no delete policy: submissions are cancelled, not removed.

-- submission_events ---------------------------------------------------------
drop policy if exists "submission_events_admin_select" on public.submission_events;
create policy "submission_events_admin_select" on public.submission_events
  for select to authenticated using (public.is_admin());

drop policy if exists "submission_events_admin_insert" on public.submission_events;
create policy "submission_events_admin_insert" on public.submission_events
  for insert to authenticated with check (public.is_admin());

-- admin_profiles ------------------------------------------------------------
-- A signed-in user may read their own row (that is how the app confirms admin
-- status); admins may read the whole table.
drop policy if exists "admin_profiles_select_self" on public.admin_profiles;
create policy "admin_profiles_select_self" on public.admin_profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());

-- Rows are created by an operator with the service role / SQL editor, so there
-- is no insert or update policy: admins cannot promote themselves or others
-- from inside the app.

-- Make sure the anon role has no leftover table privileges.
revoke all on public.areas             from anon;
revoke all on public.submissions       from anon;
revoke all on public.submission_events from anon;
revoke all on public.admin_profiles    from anon;
