-- The landing page's own events, and the side events that never reached this
-- table at all.
--
-- Two things happen here, and the second one is a repair.
--
-- The addition: the landing page grew a named primary button, a secondary
-- button beside it, and its own copy of the four food-app tiles. Each is a
-- decision a customer makes BEFORE the wizard exists, which is precisely the
-- stretch of the funnel that currently reports one number - landing_viewed -
-- and then nothing until /compare. Naming them is what turns "people arrive and
-- leave" into a sentence about which of the three offers on the screen they
-- took.
--
-- The repair: SIDE_EVENTS in lib/analytics/funnel.ts has carried app_opened
-- since the food-app card was built, and scroll_0 through scroll_100 since the
-- upload screen got a scroll depth reading. Neither name was ever added to this
-- constraint. isTrackedEvent() let them through, the browser sent them, and
-- Postgres refused every insert - silently, because /api/events swallows its
-- errors on purpose so that counting can never put an error in front of a
-- customer. The result is that both of those readings have been empty since the
-- day they were written, and nothing said so.
--
-- So this list is the full set of names the client can currently send, not just
-- the new ones: isTrackedEvent() is the only other gate, and the two are meant
-- to agree exactly.
--
-- Same pattern as 0010 and 0021 - a migration that may already have been
-- applied somewhere is not a file to rewrite, so the constraint is dropped and
-- re-added here rather than edited in place.
alter table public.funnel_events
  drop constraint if exists funnel_events_event_check;

alter table public.funnel_events
  add constraint funnel_events_event_check check (
    event in (
      -- The funnel proper, in FUNNEL_STEPS order.
      'landing_viewed',
      'wizard_started',
      'cart_uploaded',
      'step_basket',
      'step_where',
      'step_review',
      'submitted',
      'result_viewed',
      'keeta_opened',

      -- Detours, not rungs. Stored the same way and stepped over by every
      -- calculation that walks FUNNEL_STEPS.
      'app_opened',
      'landing_app_opened',
      'returned_from_app',
      'cta_check_cart',
      'cta_example',
      'scroll_0',
      'scroll_25',
      'scroll_50',
      'scroll_75',
      'scroll_100'
    )
  );
