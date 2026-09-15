-- Where the customer came from, kept on the submission.
--
-- 0014 read campaign parameters off the /go/ URL, which was the wrong end of
-- the visit. They exist on the FIRST URL of a session and nowhere else: by the
-- time somebody taps through to Keeta they are several navigations past the
-- advert that paid for them, and reading a query string that long gone is how a
-- report comes to say every customer arrived from nowhere.
--
-- Captured on arrival instead, stored here when the submission is written, and
-- inherited by the click. That makes the whole chain one join:
--
--   Instagram ad 2 -> landing -> screenshot sent -> result -> switched to Keeta
--
-- None of this identifies anybody. These are the labels we put on our own
-- adverts, the page the advert pointed at, and the origin of whatever sent
-- them - no path, no query, nothing about what they were reading.
alter table public.submissions
  add column if not exists utm_source       text,
  add column if not exists utm_medium       text,
  add column if not exists utm_campaign     text,
  add column if not exists utm_content      text,
  add column if not exists utm_term         text,
  -- One column, not three. A visit carries fbclid or gclid or ttclid, never
  -- more than one, and three columns would mean two empty ones on every row.
  add column if not exists click_id         text,
  add column if not exists landing_path     text,
  add column if not exists landing_referrer text;

comment on column public.submissions.click_id is
  'The ad platform''s own click id: fbclid, gclid or ttclid. Whichever the visit arrived with.';

comment on column public.submissions.landing_referrer is
  'Origin only, never the full referring URL. "Which site" is ours to know; "which page" is not.';

-- Campaign reporting groups by these two and filters to a window, which is the
-- only shape this table is ever asked about them.
create index if not exists submissions_campaign_idx
  on public.submissions (utm_campaign, created_at desc)
  where utm_campaign is not null;

-- ---------------------------------------------------------------------------
-- The same fields on a click
-- ---------------------------------------------------------------------------
-- 0014 already added utm_source, utm_medium, utm_campaign and campaign_id to
-- keeta_clicks. The two that were missing are added here so a click carries
-- exactly what its submission carries and the two can be compared row for row.
alter table public.keeta_clicks
  add column if not exists utm_content text,
  add column if not exists utm_term    text;

comment on table public.keeta_clicks is
  'Keeta click-through / switch intent. NOT a confirmed order - see conversion_status. '
  'Campaign columns are inherited from the submission, not read from the /go/ URL.';
