-- Whether the customer told us they are new to Keeta.
--
-- Asked on step 3, alongside the area and the total - it is the same kind of
-- question as those two: it changes what the admin should expect to find when
-- they go build the comparison. Keeta runs a new-customer discount with its
-- own minimum order; a submission flagged here is one the admin should check
-- for that discount while pricing it, not a promise this app is making on
-- Keeta's behalf.
--
-- Existing rows default false. We never asked them, and "we don't know" reads
-- the same as "no" everywhere this is used - nothing downstream treats an old
-- row as eligible for a discount nobody confirmed they qualify for.
alter table public.submissions
  add column if not exists new_to_keeta boolean not null default false;

comment on column public.submissions.new_to_keeta is
  'Customer said (step 3) they are new to Keeta. Drives the new-customer-discount note on the result - see lib/calculations/new-customer-discount.ts.';
