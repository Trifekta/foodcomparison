-- Store the upload promotion impression alongside the existing side events.
-- Keep the full accepted list in sync with FUNNEL_STEPS and SIDE_EVENTS.
alter table public.funnel_events
  drop constraint if exists funnel_events_event_check;

alter table public.funnel_events
  add constraint funnel_events_event_check check (
    event in (
      'landing_viewed',
      'wizard_started',
      'cart_uploaded',
      'step_basket',
      'step_where',
      'step_review',
      'submitted',
      'result_viewed',
      'keeta_opened',
      'promo_banner_viewed',
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
