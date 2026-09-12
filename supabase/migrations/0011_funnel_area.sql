-- Which area a visit came from, once the visit has said.
--
-- The funnel could tell you that half the people who reached the area step
-- never sent the order, and nothing about where any of them were. That is the
-- difference between "the third screen loses people" and "the third screen
-- loses people in Al Barsha, because nothing there is on Keeta yet" - and only
-- the second is something to act on.
--
-- An area is the coarsest thing the customer already volunteers: a Dubai
-- district shared by tens of thousands of people, chosen from a fixed list, and
-- already stored on their submission. It identifies nobody, which is why this
-- is the one attribute added here and why no IP, city lookup or fingerprint
-- follows it.
--
-- Null on every event before the area step, and on every event from a visit
-- that stopped earlier. That is not missing data; it is the honest answer -
-- those people never said.

alter table public.funnel_events
  add column if not exists area_id uuid references public.areas (id) on delete set null;

comment on column public.funnel_events.area_id is
  'The area this visit chose, from the area step onwards. Null before it is known.';

-- The report groups by it over a date window, so the index leads with the
-- column that is filtered and carries the one that is grouped.
create index if not exists funnel_events_area_idx
  on public.funnel_events (created_at desc, area_id)
  where area_id is not null;
