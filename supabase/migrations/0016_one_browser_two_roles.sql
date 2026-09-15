-- One browser can be a customer AND an admin.
--
-- push_subscriptions made `endpoint` unique on its own, which quietly means one
-- browser gets one row and one role. That is wrong for the only person who
-- currently uses both sides of this product: the admin tests the customer flow
-- on the same phone they run the dashboard on.
--
-- The sequence that loses the alert:
--
--   1. Admin presses "Enable new request notifications". Row written,
--      kind = 'admin'.
--   2. Admin puts a test order through on the same phone and taps the prompt on
--      the result page. The customer route upserts on `endpoint`, finds that
--      row, and REWRITES it: kind becomes 'customer', admin_id becomes null.
--   3. A new order arrives. pushToAdmins asks for kind = 'admin', finds
--      nothing, and correctly notifies nobody.
--
-- Nothing errors at any point. The admin is registered, then silently is not,
-- and the only symptom is a notification that does not arrive.
--
-- So the key is the endpoint AND the role. A browser may hold one admin
-- registration and one customer registration at once, and neither can overwrite
-- the other. Customers keep the existing behaviour within their own role - one
-- row per browser, the newest submission winning - which is what an upsert on
-- (endpoint, kind) does.
alter table public.push_subscriptions
  drop constraint if exists push_subscriptions_endpoint_key;

alter table public.push_subscriptions
  add constraint push_subscriptions_endpoint_kind_key unique (endpoint, kind);

comment on constraint push_subscriptions_endpoint_kind_key on public.push_subscriptions is
  'Endpoint AND role. Unique on endpoint alone let a customer subscription overwrite an admin one on the same device.';
