-- What an advert's numbers are called.
--
-- Meta's URL builder offers two macros for the same field. {{ad.id}} writes
-- 120249042878960301 into utm_content; {{ad.name}} writes "Same Order Different
-- Price". The adverts running when this was written use the first kind, so
-- every campaign and creative column in the admin reads as an eighteen-digit
-- number and comparing two creatives means matching two of those against Ads
-- Manager by eye.
--
-- This table is the names. It changes nothing about what is captured or stored:
-- utm_campaign and utm_content still hold exactly what the advert sent, every
-- report still groups by those values, and the export still carries them. An id
-- is a stable key and a name is not - a creative renamed in Ads Manager would
-- silently start a second row in every report if the name were the key - so the
-- key stays the id and the name is looked up beside it.
--
-- Editable from /admin/ad-labels rather than only in code, because the whole
-- point is an advert launched this morning. lib/analytics/ad-labels.ts ships
-- defaults for the sources and for the two ids already running; a row here
-- wins over them.
create table if not exists public.ad_labels (
  id         uuid primary key default gen_random_uuid(),

  -- Which column this labels. Kept apart so a campaign id and a creative id
  -- that happen to collide cannot name each other.
  kind       text not null,

  -- The value exactly as the advert stored it: a Meta object id, or a utm slug.
  value      text not null,

  -- What the admin should read instead.
  label      text not null,

  -- Anything worth remembering about the advert itself - which audience, what
  -- the hook was - that the label is too short to carry.
  notes      text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint ad_labels_kind_check check (kind in ('source', 'campaign', 'creative')),
  constraint ad_labels_value_not_blank check (length(btrim(value)) > 0),
  constraint ad_labels_label_not_blank check (length(btrim(label)) > 0),

  -- Lower-cased, because the resolver looks up case-insensitively: without
  -- this, "Instagram" and "instagram" are two rows and the second one silently
  -- never wins.
  constraint ad_labels_unique_per_kind unique (kind, value)
);

create index if not exists ad_labels_kind_idx on public.ad_labels (kind, value);

comment on table public.ad_labels is
  'Human-readable names for Meta campaign/creative ids and utm sources. Display only - nothing here is captured, stored on a submission, or grouped by.';

-- Admin-only, exactly like areas: this is internal reporting furniture and no
-- customer-facing route reads it.
alter table public.ad_labels enable row level security;

drop policy if exists "ad_labels_admin_select" on public.ad_labels;
create policy "ad_labels_admin_select" on public.ad_labels
  for select to authenticated using (public.is_admin());

drop policy if exists "ad_labels_admin_insert" on public.ad_labels;
create policy "ad_labels_admin_insert" on public.ad_labels
  for insert to authenticated with check (public.is_admin());

drop policy if exists "ad_labels_admin_update" on public.ad_labels;
create policy "ad_labels_admin_update" on public.ad_labels
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "ad_labels_admin_delete" on public.ad_labels;
create policy "ad_labels_admin_delete" on public.ad_labels
  for delete to authenticated using (public.is_admin());

revoke all on public.ad_labels from anon;

-- The adverts that were running when this was written.
--
-- on conflict do nothing, so re-running the migration cannot overwrite a name
-- the admin has since corrected - the edited row is the better one, and a
-- migration that reverted it on every deploy would be a slow, invisible bug.
insert into public.ad_labels (kind, value, label) values
  ('campaign', '120249042250420301', 'SnipSavor Validation'),
  ('creative', '120249042878960301', 'Same Order Different Price')
on conflict (kind, value) do nothing;
