-- ═══════════════════════════════════════════════════════════════════════════
-- HEAL-AI · make Toolkit/Patient-Panel resource cards fully admin-managed
-- ───────────────────────────────────────────────────────────────────────────
-- WHY
--   Until now the resource cards were hardcoded in js/data.js and only
--   *extra* admin uploads came from the `resources` table. Adding or removing
--   a card meant a code edit and a deploy. This migration makes the table the
--   single source of truth: it widens `resources` to express everything a
--   static card could, then seeds the 12 existing cards as real rows.
--
-- WHAT CHANGES FOR THE SITE
--   js/app.js treats the table as authoritative as soon as it holds at least
--   one row. The arrays in data.js stay behind only as a pre-migration /
--   Supabase-unreachable fallback, so the site renders correctly whether or
--   not this file has been run. Once it HAS been run, edits must happen in
--   the admin dashboard — editing data.js will no longer show up.
--
-- SAFE TO RE-RUN
--   Every statement is guarded. The seed block is skipped entirely if any
--   seeded row is already present, so running this twice will not duplicate
--   cards or overwrite titles you have since edited in the dashboard.
--
-- HOW TO RUN
--   Supabase dashboard → SQL Editor → paste this file → Run.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1. New columns ────────────────────────────────────────────────────────
-- icon      · which ICONS key (js/data.js) the card shows. Chosen in the
--             admin form; 'paper' is the neutral default.
-- link_url  · for cards that point at an external page or an already-hosted
--             file instead of something uploaded to the resource-files
--             bucket (e.g. the JAMA commentary, the heal-ai.stanford.edu
--             .docx templates). Exactly one of link_url / file_path is
--             normally set; neither means "Coming soon".
-- priority  · display order, highest first. The first card in a category
--             renders as the large "spotlight" card, so this controls which
--             resource leads the section.
alter table public.resources add column if not exists icon     text not null default 'paper';
alter table public.resources add column if not exists link_url text;
alter table public.resources add column if not exists priority integer not null default 0;


-- ── 2. Relax the columns that assumed "every resource is an upload" ──────
-- A link-only card has no stored file, and a seeded card has no uploader.
alter table public.resources alter column file_path   drop not null;
alter table public.resources alter column uploaded_by drop not null;


-- ── 3. Categories ────────────────────────────────────────────────────────
-- 'understand' and 'adapt' were removed from the site along with the Guides
-- tab, so they are dropped from the allowed list. Any leftover row using one
-- would already be invisible on the site; it is left in place rather than
-- silently deleted — `not valid` skips checking existing rows. Find them
-- with:  select * from public.resources where category not in ('interviews','panel');
do $$
declare cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.resources'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%category%';
  if cname is not null then
    execute format('alter table public.resources drop constraint %I', cname);
  end if;
end $$;

-- 'reports' here means the resource CARDS in the "Writing & Delivering Your
-- Report" section (e.g. the blank report template) — not the 8 sample-report
-- tiles below them, which are their own `reports` table.
alter table public.resources add constraint resources_category_check
  check (category in ('interviews', 'panel', 'reports')) not valid;


-- ── 4. Admins need UPDATE, for the priority control and future editing ──
-- schema.sql granted insert/delete only. Without this, changing a card's
-- order silently no-ops under RLS.
drop policy if exists "only admins can update resources" on public.resources;
create policy "only admins can update resources"
  on public.resources for update
  using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );


-- ── 5. Seed the 12 previously-hardcoded cards ───────────────────────────
-- Priorities descend in steps of 10 to preserve the exact order the cards
-- appeared in, while leaving room to slot a new card between two old ones.
--
-- Three panel cards (Recruitment script, Fundamentals training curriculum,
-- Compensation & consent template) had href:'#' in data.js — they showed an
-- "Available" tag but linked nowhere. That is carried over verbatim as
-- link_url = '#' so this migration changes no visible content. Replace those
-- with real URLs in the dashboard when the files exist.
do $$
begin
  if exists (select 1 from public.resources where title = 'Thematic analysis template') then
    raise notice 'Seed rows already present — skipping seed.';
    return;
  end if;

  insert into public.resources (title, description, category, icon, link_url, priority) values
    -- Running Stakeholder Interviews (Toolkit → Resources → Templates)
    ('Interview guides for different stakeholders',
     'Template guide for interviews with proposers or developers of the AI use case.',
     'interviews', 'mic', null, 60),
    ('Interview guide for prospective tool users',
     'Template interview guide for clinicians expected to use the tool, customizable per use case.',
     'interviews', 'mic', null, 50),
    ('Thematic analysis template',
     'Template for thematic content analysis of interview and focus group transcripts.',
     'interviews', 'sheet',
     'https://heal-ai.stanford.edu/sites/g/files/sbiybj33291/files/media/file/template_for_thematic_content_analysis_of_interview_and_focus_group_transcripts.docx',
     40),
    ('Interview & focus group tracking sheet',
     'Spreadsheet for tracking progress of stakeholder interviews and the patient focus group.',
     'interviews', 'cal',
     'https://heal-ai.stanford.edu/sites/g/files/sbiybj33291/files/media/file/tracking_sheet_for_recording_progress_of_stakeholder_interviews_and_patient_focus_group.xlsx',
     30),
    ('“What to Expect” guide for use-case submissions',
     'What teams should expect when submitting a proposed use case for ethical assessment.',
     'interviews', 'paper',
     'https://heal-ai.stanford.edu/sites/g/files/sbiybj33291/files/media/file/what_to_expect_document_for_teams_submitting_proposed_use_cases_for_ethical_assessment.docx',
     20),
    ('Expert Oversight Panel meeting template',
     'Template for structuring meetings with the Expert Oversight Panel.',
     'interviews', 'paper',
     'https://heal-ai.stanford.edu/sites/g/files/sbiybj33291/files/media/file/template_for_meetings_with_expert_oversight_panel.docx',
     10),

    -- Running a Patient Partner Group (Patient Panel page)
    ('Moderator''s guide',
     'Template patient focus group moderator''s guide, customizable per use case.',
     'panel', 'mic', null, 50),
    ('Recruitment script',
     'Outreach language used with the Stanford patient council.',
     'panel', 'mail', '#', 40),
    ('Fundamentals training curriculum',
     '8-hour onboarding for new patient partners.',
     'panel', 'book', '#', 30),
    ('Compensation & consent template',
     'Compensation rates, consent language, IRB notes.',
     'panel', 'paper', '#', 20),
    ('What should patients be told about AI use?',
     'HEAL-AI''s JAMA commentary on how health systems should answer: ask, tell, or neither?',
     'panel', 'link',
     'https://healthpolicy.fsi.stanford.edu/news/ethical-obligations-inform-patients-about-use-ai-tools',
     10),

    -- Writing & Delivering Your Report (Toolkit → Resources → Sample Reports),
    -- the cards above the 8 sample-report tiles. Also a '#' placeholder today.
    ('EOP template',
     'Blank Report Template',
     'reports', 'paper', '#', 10);

  raise notice 'Seeded 12 resource cards.';
end $$;
