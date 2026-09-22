-- Add scroll depth tracking events to funnel_events
--
-- ScrollDepth component tracks how far down the page a visitor scrolls,
-- bucketed into 5 levels (0%, 25%, 50%, 75%, 100%). These are stored as
-- side events in funnel_events alongside main funnel steps, allowing the
-- admin dashboard to see scroll behavior in the visitor's history.

alter table public.funnel_events
  drop constraint if exists funnel_events_event_check;

alter table public.funnel_events
  add constraint funnel_events_event_check check (
    event in (
      'wizard_started',
      'cart_uploaded',
      'landing_viewed',
      'step_basket',
      'step_where',
      'step_review',
      'submitted',
      'result_viewed',
      'keeta_opened',
      'scroll_0',
      'scroll_25',
      'scroll_50',
      'scroll_75',
      'scroll_100'
    )
  );

comment on column public.funnel_events.event is
  'Funnel step or side event. Main steps track progress; side events like scroll_* are context. See lib/analytics/funnel.ts for full list.';
