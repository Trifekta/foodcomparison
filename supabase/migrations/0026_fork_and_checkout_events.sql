-- The fork's two answers, and the second screenshot.
--
-- Three names the client can now send and this table could not store:
--
--   fork_have_screenshot / fork_need_to_take
--     The two-path fork at the top of the upload screen shipped without any
--     event on its buttons. The screen was asking every visitor the exact
--     question the funnel cannot answer - do you have a screenshot, or do you
--     need to go and take one - and discarding every reply.
--
--   checkout_uploaded
--     cart_uploaded has only ever covered the first slot, so a visit that sent
--     both screenshots and a visit that sent one were indistinguishable here.
--
-- As in 0023 and every migration before it, this lists the FULL set of names
-- the client can send rather than only the new ones, because the constraint is
-- replaced wholesale rather than extended. 0025_scroll_depth_events.sql got
-- that wrong - it rewrote the list from memory and silently dropped
-- app_opened, landing_app_opened, returned_from_app, cta_check_cart and
-- cta_example, which would have killed landing CTA and food-app tracking the
-- moment it applied. It was reverted before merge, and
-- funnel-events-constraint.test.ts is what caught it: that test reads this
-- file and diffs it against SIDE_EVENTS, so a name missing here now fails CI
-- rather than failing silently in production for months.
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
      'fork_have_screenshot',
      'fork_need_to_take',
      'checkout_uploaded',
      'scroll_0',
      'scroll_25',
      'scroll_50',
      'scroll_75',
      'scroll_100'
    )
  );
