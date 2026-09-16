-- What the screenshots actually showed, rather than how many arrived.
--
-- The caveat on a customer's result - "we couldn't confirm the fees and
-- discounts" - was driven by checkout_image_path being null, i.e. by whether a
-- second file was uploaded. That was wrong, and the delivery apps are why.
-- Talabat, noon and Keeta print the whole payment summary on the cart page:
-- subtotal, discount, delivery, service fee and the final total, all on the one
-- screen somebody is already looking at. A customer on any of those three sends
-- one screenshot that settles the bill completely and was then told we could
-- not check their fees. Deliveroo is the app that genuinely splits it across
-- two screens, and it is the minority.
--
-- So the record becomes what came back from reading the screenshots: a final
-- total that was printed on screen - the extraction prompt forbids deriving
-- one, so a non-empty value means it was really there - beside at least one fee
-- or discount line, which is what a payment summary has and a bare item list
-- does not.
alter table public.submissions
  add column if not exists totals_confirmed boolean not null default false;

comment on column public.submissions.totals_confirmed is
  'A screenshot showed a printed final total next to its fees/discount. NOT "two files were uploaded".';

-- Every row taken before this column existed is treated the way it was treated
-- at the time: a checkout screenshot meant no caveat. Backfilling keeps old
-- result pages saying what they said yesterday, which matters because a
-- customer can still be holding the link.
update public.submissions
  set totals_confirmed = true
  where checkout_image_path is not null;
