-- A visit is now one browser for one Dubai day, not one tab.
--
-- The id was held in sessionStorage, so it died with the tab: the same person
-- arriving from Instagram, going back, and tapping the link again was three
-- visits, three rows in the live table, and three separate denominators under
-- every funnel percentage. It is now held in localStorage stamped with the
-- Dubai day it was made on, and replaced at midnight - see visitId() in
-- lib/analytics/track.ts.
--
-- Nothing about the data changes: still a random value the browser makes up,
-- still tied to no account, contact detail, IP or device fingerprint, and
-- still thrown away on a fixed schedule rather than following anybody. It is
-- one day long instead of one tab long, which is the honest denominator for
-- "how many people did this" - but it is closer to a person than the old
-- comment claimed, so the comment is corrected here rather than left to
-- mislead whoever reads this table next.
--
-- Comments only. No column, index or policy is touched, and rows written
-- under the old lifetime stay exactly as they are: they simply count a tab
-- where later rows count a day.
comment on table public.funnel_events is
  'Anonymous step counts for the customer funnel. visit_id is one browser for one Dubai day, reset at midnight - not an account, and not a person across days.';

comment on table public.visit_presence is
  'Latest-seen per visit, for the admin "who is on the site now" view. Overwritten in place, not a history - see funnel_events for that. visit_id is one browser for one Dubai day, reset at midnight.';
