-- The confirm step now starts from a vision model's read of the cart
-- screenshot, so two things need recording that a typed-only basket did not
-- need: the price printed against each row, and where the row came from.

-- The price printed on the item's row in the screenshot, in fils. Deliberately
-- the row price rather than a per-unit price: delivery apps differ on which
-- they show, and dividing would invent precision the screenshot does not have.
-- Null whenever no price was visible, which is normal.
alter table public.submission_items
  add column if not exists line_price_minor integer;

alter table public.submission_items
  drop constraint if exists submission_items_line_price_range;
alter table public.submission_items
  add constraint submission_items_line_price_range
  check (line_price_minor is null or line_price_minor between 1 and 50000000);

-- Where the row came from, so a model's guess is never mistaken for something
-- the customer asserted:
--   customer  - typed from scratch
--   extracted - proposed by the model and confirmed unchanged
--   edited    - proposed by the model, then corrected by the customer
--
-- 'edited' is the useful one. Every row carrying it is a labelled example of
-- the model getting something wrong, collected as a side effect of normal use.
alter table public.submission_items
  add column if not exists source text not null default 'customer';

alter table public.submission_items
  drop constraint if exists submission_items_source_valid;
alter table public.submission_items
  add constraint submission_items_source_valid
  check (source in ('customer', 'extracted', 'edited'));

create index if not exists submission_items_source_idx
  on public.submission_items (source);
