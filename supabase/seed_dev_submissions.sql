-- OPTIONAL development seed data.
--
-- Run this only on a development project. Every contact detail below is fake
-- (reserved-for-documentation numbers and example.com addresses) and the image
-- paths point at nothing, so the admin detail screen will show its
-- "screenshot unavailable" state for these rows - that is expected.
--
-- Do NOT run this on production.

with picked as (
  select
    (select id from public.areas where name = 'Al Karama' limit 1)                as karama,
    (select id from public.areas where name = 'Jumeirah Village Circle' limit 1)  as jvc,
    (select id from public.areas where name = 'Dubai Marina' limit 1)             as marina
)
insert into public.submissions (
  reference_number, status, source_app, area_id, current_total,
  comparison_app, comparison_total, saving_amount, saving_percentage,
  cart_image_path, checkout_image_path, contact_type, whatsapp_number, email,
  marketing_consent, admin_notes, review_started_at, completed_at
)
select * from (
  select
    'FFA-260910-0001', 'result_ready', 'Talabat', picked.karama, 82.00,
    'Keeta', 63.00, 19.00, 23.17,
    'submissions/seed-0001/cart.png', null, 'whatsapp', '+971500000001', null,
    false, 'Seed row: matched basket at the Karama branch.', now() - interval '2 hours', now() - interval '1 hour'
  from picked
  union all
  select
    'FFA-260910-0002', 'result_ready', 'Deliveroo', picked.jvc, 67.50,
    'Keeta', 65.00, 2.50, 3.70,
    'submissions/seed-0002/cart.png', 'submissions/seed-0002/checkout.png', 'email', null, 'seed.customer@example.com',
    true, 'Seed row: small saving, delivery fee was the difference.', now() - interval '3 hours', now() - interval '2 hours'
  from picked
  union all
  select
    'FFA-260910-0003', 'new', 'Careem Food', picked.marina, 95.00,
    'Keeta', null, null, null,
    'submissions/seed-0003/cart.png', null, 'whatsapp', '+971500000003', null,
    false, null, null, null
  from picked
) as seeded
on conflict (reference_number) do nothing;

insert into public.submission_events (submission_id, event_type, new_status, metadata)
select id, 'submission_created', 'new', jsonb_build_object('seed', true)
from public.submissions
where reference_number in ('FFA-260910-0001','FFA-260910-0002','FFA-260910-0003')
  and not exists (
    select 1 from public.submission_events e
    where e.submission_id = public.submissions.id and e.event_type = 'submission_created'
  );
