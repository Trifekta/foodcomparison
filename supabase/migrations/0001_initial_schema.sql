-- FindFoodae (Trifekta) - initial schema
-- Phase 1: manual comparison. One submission per customer request, compared by
-- an admin against Keeta, with a lightweight audit trail.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- areas
-- Dubai areas the customer can pick from. The test_* columns are INTERNAL: they
-- hold the saved Keeta test address an admin uses when rebuilding a basket and
-- must never be sent to a customer.
-- ---------------------------------------------------------------------------
create table if not exists public.areas (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  city                  text not null default 'Dubai',
  emirate               text not null default 'Dubai',
  active                boolean not null default true,
  sort_order            integer not null default 100,
  test_location_label   text,
  test_latitude         double precision,
  test_longitude        double precision,
  admin_location_notes  text,
  created_at            timestamptz not null default now(),
  constraint areas_name_not_blank check (length(btrim(name)) > 0),
  constraint areas_name_unique_per_city unique (city, name)
);

create index if not exists areas_active_sort_idx on public.areas (active, sort_order, name);

-- ---------------------------------------------------------------------------
-- submissions
-- ---------------------------------------------------------------------------
create table if not exists public.submissions (
  id                       uuid primary key default gen_random_uuid(),
  reference_number         text not null unique,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),

  status                   text not null default 'new',

  source_app               text not null,
  source_app_other         text,
  area_id                  uuid references public.areas (id) on delete set null,

  current_total            numeric(10,2) not null,
  comparison_app           text not null default 'Keeta',
  comparison_total         numeric(10,2),
  saving_amount            numeric(10,2),
  saving_percentage        numeric(6,2),

  cart_image_path          text not null,
  checkout_image_path      text,

  contact_type             text not null,
  whatsapp_number          text,
  email                    text,
  marketing_consent        boolean not null default false,

  admin_notes              text,
  restaurant_found         text,
  comparison_location_note text,
  result_message           text,

  result_sent_at           timestamptz,
  review_started_at        timestamptz,
  completed_at             timestamptz,

  -- Reserved for a future precise-location flow. Phase 1 never asks for GPS.
  customer_latitude        double precision,
  customer_longitude       double precision,

  constraint submissions_status_check check (
    status in ('new','reviewing','comparison_found','no_saving','result_ready','result_sent','cancelled')
  ),
  constraint submissions_contact_type_check check (contact_type in ('whatsapp','email')),
  constraint submissions_contact_present check (
    (contact_type = 'whatsapp' and whatsapp_number is not null)
    or (contact_type = 'email' and email is not null)
  ),
  constraint submissions_source_app_other_check check (
    source_app <> 'Other' or (source_app_other is not null and length(btrim(source_app_other)) > 0)
  ),
  constraint submissions_current_total_range check (current_total > 0 and current_total <= 5000),
  constraint submissions_comparison_total_range check (
    comparison_total is null or (comparison_total >= 0 and comparison_total <= 5000)
  ),
  -- A saving is never negative: a pricier alternative means "no cheaper option".
  constraint submissions_saving_amount_non_negative check (saving_amount is null or saving_amount >= 0),
  constraint submissions_saving_percentage_range check (
    saving_percentage is null or (saving_percentage >= 0 and saving_percentage <= 100)
  ),
  constraint submissions_cart_image_present check (length(btrim(cart_image_path)) > 0)
);

create index if not exists submissions_created_at_idx on public.submissions (created_at desc);
create index if not exists submissions_status_idx on public.submissions (status);
create index if not exists submissions_area_id_idx on public.submissions (area_id);
create index if not exists submissions_source_app_idx on public.submissions (source_app);
-- reference_number is already indexed by its unique constraint; no second index needed.

-- ---------------------------------------------------------------------------
-- submission_events - audit trail
-- ---------------------------------------------------------------------------
create table if not exists public.submission_events (
  id              uuid primary key default gen_random_uuid(),
  submission_id   uuid not null references public.submissions (id) on delete cascade,
  event_type      text not null,
  previous_status text,
  new_status      text,
  metadata        jsonb,
  created_at      timestamptz not null default now(),
  created_by      uuid references auth.users (id) on delete set null,
  constraint submission_events_type_check check (
    event_type in (
      'submission_created','review_started','comparison_added',
      'status_changed','result_generated','result_sent'
    )
  )
);

create index if not exists submission_events_submission_idx
  on public.submission_events (submission_id, created_at desc);

-- ---------------------------------------------------------------------------
-- admin_profiles - who is allowed into the dashboard
-- role is text + check so 'reviewer' / 'manager' can be added without a type change.
-- ---------------------------------------------------------------------------
create table if not exists public.admin_profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  role         text not null default 'admin',
  created_at   timestamptz not null default now(),
  constraint admin_profiles_role_check check (role in ('admin','reviewer','manager'))
);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists submissions_set_updated_at on public.submissions;
create trigger submissions_set_updated_at
  before update on public.submissions
  for each row execute function public.set_updated_at();
