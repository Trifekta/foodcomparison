-- What kind of browser a visit came from, beside the address it came from.
--
-- Not for its own sake. visitor_ips is what answers "was that three people, or
-- one person three times", and an address alone cannot settle it: carriers
-- here put many subscribers behind one, so a shared IP is evidence and not
-- proof. The browser string is a second weak signal, and the pair is worth
-- more than either half - two visits from one address AND one browser, minutes
-- apart, are far more likely one person than the address alone suggests.
--
-- Deliberately additive. Rows written before this migration keep a null, and
-- groupVisitors refuses to group a visit it knows nothing about rather than
-- guessing, so old data stays exactly as it is and simply declines to answer.
-- Nothing reads this column to decide identity on its own.
--
-- The same metadata keeta_clicks has recorded since 0014, for the same reason
-- given there: request metadata that was already on the wire, with no address,
-- name or number attached to it. Capped in the route before it arrives.
alter table public.visitor_ips
  add column if not exists user_agent text;

comment on column public.visitor_ips.user_agent is
  'The request user-agent, capped at 400 characters. A weak second signal beside client_ip for telling repeat visits from one device apart from different people sharing an address - never identity on its own. Null on rows written before this column existed.';
