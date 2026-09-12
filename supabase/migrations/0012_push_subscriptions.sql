-- Browser push subscriptions, for customers and admins.
--
-- The customer's result is produced by a person, minutes after they ask for it,
-- and until now the only way they learned it was ready was by keeping the page
-- open or waiting for somebody to send a WhatsApp message by hand. A push is
-- the one channel that survives the tab being closed.
--
-- One table for both audiences rather than two. The rows differ only in who
-- they belong to, every query wants "the subscriptions to notify", and two
-- tables would mean two of every function that sends one.

create table if not exists public.push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- Who this endpoint belongs to. The check below is what stops a customer
  -- subscription from claiming to be an admin one.
  kind          text not null check (kind in ('customer', 'admin')),

  -- The push service's address for this browser. Unique because a browser that
  -- resubscribes returns the same endpoint, and a second row for it would send
  -- the same person the same notification twice.
  endpoint      text not null unique,

  -- The browser's public key and auth secret, from PushSubscription.getKey().
  -- Both are base64url. They are useless without the message they encrypt and
  -- are never sent back to any browser.
  p256dh        text not null,
  auth          text not null,

  -- Exactly one of these, enforced below.
  submission_id uuid references public.submissions (id) on delete cascade,
  admin_id      uuid references auth.users (id) on delete cascade,

  -- Push services answer 404 or 410 for an endpoint that is gone. Rather than
  -- deleting on the first failure - a network blip is not the same as an
  -- unsubscribe - the count is kept and the row removed when the service says
  -- the endpoint itself is dead.
  failure_count integer not null default 0,
  last_sent_at  timestamptz,

  constraint push_subscriptions_owner_check check (
    (kind = 'customer' and submission_id is not null and admin_id is null)
    or (kind = 'admin' and admin_id is not null and submission_id is null)
  )
);

-- The two lookups that happen: "who do I tell about this submission" and
-- "which admins are listening".
create index if not exists push_subscriptions_submission_idx
  on public.push_subscriptions (submission_id)
  where submission_id is not null;

create index if not exists push_subscriptions_admin_idx
  on public.push_subscriptions (kind)
  where kind = 'admin';

drop trigger if exists push_subscriptions_set_updated_at on public.push_subscriptions;
create trigger push_subscriptions_set_updated_at
  before update on public.push_subscriptions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Access
-- ---------------------------------------------------------------------------
-- Same posture as every other table here: anon has no policy at all, so the
-- only way a row is written is through the server. The customer's subscribe
-- endpoint is public - it has to be, the customer is not signed in to anything
-- - so it writes with the service role after proving the caller holds the
-- result token for that submission, exactly as /api/events does.
--
-- Admins can read and delete their own rows so the dashboard can show whether
-- this device is subscribed and turn it off again. They cannot insert: that
-- goes through the server action, which is what ties the row to the signed-in
-- account rather than to whatever the browser claims.
alter table public.push_subscriptions enable row level security;

drop policy if exists "push_admin_select_own" on public.push_subscriptions;
create policy "push_admin_select_own" on public.push_subscriptions
  for select to authenticated
  using (public.is_admin() and kind = 'admin' and admin_id = auth.uid());

drop policy if exists "push_admin_delete_own" on public.push_subscriptions;
create policy "push_admin_delete_own" on public.push_subscriptions
  for delete to authenticated
  using (public.is_admin() and kind = 'admin' and admin_id = auth.uid());

revoke all on public.push_subscriptions from anon;
