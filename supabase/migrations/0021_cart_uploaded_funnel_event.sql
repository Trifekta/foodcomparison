-- Uploading a screenshot, as its own step.
--
-- The funnel could already say "opened the wizard" and "confirmed their
-- basket" (the second screen), but nothing in between - and the gap between
-- those two is not one moment, it is two: picking a screenshot, and then
-- deciding to continue past it. A visit that uploads a screenshot and then
-- walks away - the read still running, or just distracted - looked exactly
-- like a visit that never uploaded anything at all, because nothing fired
-- between wizard_started and step_basket. The Live page's own activity feed
-- is what made this visible: page after page of "Opened the wizard" with
-- nothing after it, no way to tell which of those people ever touched the
-- upload button.
--
-- Same pattern as 0010's landing_viewed: a migration that may already have
-- been applied somewhere is not a file to rewrite, so the constraint is
-- dropped and re-added here rather than editing 0009 or 0010 in place.
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
      'keeta_opened'
    )
  );
