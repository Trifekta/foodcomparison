-- Admin-assisted basket extraction.
--
-- An admin presses "Extract basket"; the screenshot is read by OCR in their own
-- browser, the resulting TEXT (not the image) is structured by a model, and the
-- admin reviews and confirms it before anything is saved. This table is the
-- record of that: every run, whether or not it was confirmed, with enough
-- context to measure accuracy afterwards and to explain any figure to anyone
-- who asks where it came from.

create table if not exists public.submission_extractions (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,

  -- 'ocr_llm' is the normal route and keeps the screenshot with us.
  -- 'vision' sends the image itself and is only ever an explicit admin choice.
  method        text not null,
  status        text not null,

  -- The complete OCR output, verbatim. Null on the vision route, which runs no
  -- OCR. Kept whole rather than trimmed: it is the only way to tell later
  -- whether a bad basket was a bad read or bad structuring.
  ocr_text      text,
  ocr_confidence numeric(5,2),
  ocr_engine    text,
  ocr_ms        integer,

  model          text,
  prompt_version text,
  llm_ms         integer,

  -- The model's structured output, exactly as it came back after cleaning.
  -- Never edited: corrections live in `confirmed` so the two can be compared.
  structured       jsonb,
  uncertain_fields text[] not null default '{}',
  error            text,

  -- Set only when an admin explicitly confirms. An unconfirmed row is a
  -- suggestion nobody accepted, and must never be read as fact.
  confirmed        jsonb,
  confirmed_at     timestamptz,
  confirmed_by     uuid references auth.users (id) on delete set null,

  created_at    timestamptz not null default now(),
  created_by    uuid references auth.users (id) on delete set null,

  constraint submission_extractions_method_valid check (method in ('ocr_llm', 'vision')),
  constraint submission_extractions_status_valid check (status in ('ok', 'failed')),
  constraint submission_extractions_ocr_confidence_range
    check (ocr_confidence is null or ocr_confidence between 0 and 100),
  -- A confirmation is a person, a moment and a payload, or it is nothing.
  constraint submission_extractions_confirmed_together check (
    (confirmed is null and confirmed_at is null)
    or (confirmed is not null and confirmed_at is not null)
  )
);

create index if not exists submission_extractions_submission_idx
  on public.submission_extractions (submission_id, created_at desc);

-- Supports the accuracy questions: how did each method do, per prompt version.
create index if not exists submission_extractions_method_idx
  on public.submission_extractions (method, status, created_at desc);

-- Which run a stored item came from, so a confirmed basket can be traced back
-- to the read that proposed it.
alter table public.submission_items
  add column if not exists extraction_id uuid
  references public.submission_extractions (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Row Level Security. Admins only, like every other internal table. Customers
-- never see extractions; the anonymous role cannot touch this at all.
-- ---------------------------------------------------------------------------
alter table public.submission_extractions enable row level security;

drop policy if exists "submission_extractions_admin_select" on public.submission_extractions;
create policy "submission_extractions_admin_select" on public.submission_extractions
  for select to authenticated using (public.is_admin());

drop policy if exists "submission_extractions_admin_insert" on public.submission_extractions;
create policy "submission_extractions_admin_insert" on public.submission_extractions
  for insert to authenticated with check (public.is_admin());

drop policy if exists "submission_extractions_admin_update" on public.submission_extractions;
create policy "submission_extractions_admin_update" on public.submission_extractions
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

revoke all on public.submission_extractions from anon;
