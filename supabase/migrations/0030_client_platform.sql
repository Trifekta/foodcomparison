-- Which client a submission or funnel step came from: the website, or the
-- Android or iOS app.
--
-- Until now there was only the website, so nothing needed to say so. The mobile
-- apps talk to the same endpoints and write to the same tables, and without
-- this column their traffic would be indistinguishable from the web's - an app
-- submission would inflate the web funnel it never passed through, and nobody
-- could tell which client a broken submission came from.
--
-- Existing rows default to 'web', which is the truth: nothing else existed. The
-- website never sends a client header and never writes these columns, so it
-- keeps working whether or not this file has been run. Only the /api/v1 routes
-- and app events write them - see lib/api/v1/client.ts.
--
-- app_version is what the app reported (semver, e.g. 1.4.2). Null for the web,
-- which is deployed rather than installed and has no version anybody is stuck on.
--
-- Safe to run more than once.

alter table public.submissions
  add column if not exists client_platform text not null default 'web',
  add column if not exists app_version text;

alter table public.submissions
  drop constraint if exists submissions_client_platform_check;
alter table public.submissions
  add constraint submissions_client_platform_check
  check (client_platform in ('web', 'android', 'ios'));

alter table public.submissions
  drop constraint if exists submissions_app_version_length;
alter table public.submissions
  add constraint submissions_app_version_length
  check (app_version is null or length(app_version) <= 32);

comment on column public.submissions.client_platform is
  'web | android | ios. Set from the X-SnipSavor-Client header on /api/v1 routes; the website leaves the default.';
comment on column public.submissions.app_version is
  'Semver the mobile app reported. Null for the website.';

alter table public.funnel_events
  add column if not exists client_platform text not null default 'web',
  add column if not exists app_version text;

alter table public.funnel_events
  drop constraint if exists funnel_events_client_platform_check;
alter table public.funnel_events
  add constraint funnel_events_client_platform_check
  check (client_platform in ('web', 'android', 'ios'));

alter table public.funnel_events
  drop constraint if exists funnel_events_app_version_length;
alter table public.funnel_events
  add constraint funnel_events_app_version_length
  check (app_version is null or length(app_version) <= 32);

comment on column public.funnel_events.client_platform is
  'web | android | ios. Set from the X-SnipSavor-Client header; the website never sends one.';
comment on column public.funnel_events.app_version is
  'Semver the mobile app reported. Null for the website.';
