-- Wizard drafts: server-side progress so a reloaded tab can resume.
--
-- The customer flow sends people to a food app on purpose, and a phone -
-- Instagram's and Facebook's in-app browsers above all - routinely discards the
-- backgrounded tab and reloads it on return. Browser storage in those browsers
-- is not reliable enough to hold progress, and a File never survives a reload,
-- so the screenshot and the answers are kept here for a short while instead.
--
-- Purely additive. No existing table is touched, so application code that
-- predates this file keeps working unchanged, and code that expects it treats
-- its absence as "resume unavailable" rather than failing.
--
-- Access is by bearer token. The browser holds a random 256-bit token; this
-- table holds only its SHA-256, so a leaked row cannot be turned back into a
-- working token. RLS is on with no policies: only the service role, used by
-- the draft API routes, can read or write a row.
--
-- The WhatsApp number is never stored here - the application drops it before
-- writing, and the customer re-enters it if a reload costs it.

create table if not exists public.wizard_drafts (
  id                   uuid primary key default gen_random_uuid(),
  token_hash           text not null unique,
  progress             jsonb not null default '{}'::jsonb,
  cart_image_path      text,
  checkout_image_path  text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  expires_at           timestamptz not null,

  constraint wizard_drafts_token_hash_shape check (token_hash ~ '^[0-9a-f]{64}$'),

  -- A draft can only ever point at its own files. The application derives
  -- these paths from the row id and never from the request; this makes the
  -- database refuse anything else too.
  constraint wizard_drafts_cart_path_owned check (
    cart_image_path is null
    or cart_image_path ~ ('^drafts/' || id::text || '/cart\.(jpg|png|webp)$')
  ),
  constraint wizard_drafts_checkout_path_owned check (
    checkout_image_path is null
    or checkout_image_path ~ ('^drafts/' || id::text || '/checkout\.(jpg|png|webp)$')
  )
);

create index if not exists wizard_drafts_expires_at_idx
  on public.wizard_drafts (expires_at);

alter table public.wizard_drafts enable row level security;

comment on table public.wizard_drafts is
  'Temporary wizard progress for reload recovery. Bearer-token access via the service role only; expired rows and their drafts/ files are pruned by /api/cron/prune-drafts.';
