-- ═══════════════════════════════════════════════════════════════════════════
-- HEAL-AI · ALL MIGRATIONS, IN ORDER
-- ───────────────────────────────────────────────────────────────────────────
-- Everything the site needs on top of the three base schema files
-- (schema.sql, news_schema.sql, reports_team_schema.sql), concatenated in
-- dependency order so this one file can be pasted into the Supabase SQL
-- Editor and run.
--
-- SAFE TO RUN WHETHER OR NOT YOU HAVE RUN THE PIECES BEFORE
--   Every statement is guarded: `add column if not exists`, `create index
--   if not exists`, `drop policy if exists` before each create, `on
--   conflict do nothing` on the bucket insert, and each seed block skips
--   itself if its rows are already there. Re-running duplicates nothing
--   and overwrites nothing you have edited in the dashboard.
--
-- STATE AS CHECKED AGAINST YOUR DATABASE (2026-09-22)
--   resources.icon / link_url / priority ... already applied (12 rows)
--   team_members.affiliation ............... already applied
--   reports (admin-managed) ................ already applied (15 rows)
--   news_items.featured .................... already applied
--   podcasts / news-media bucket ........... NOT YET APPLIED  <-- the point
--                                            of running this
--   So in practice only the last section will change anything. The rest is
--   included so there is one file to keep, not five to sequence.
--
-- HOW TO RUN
--   Supabase dashboard -> SQL Editor -> New query -> paste -> Run.
--   Expect "Success. No rows returned"; NOTICEs about skipped seeds are
--   the guards doing their job.
-- ═══════════════════════════════════════════════════════════════════════════



-- ###########################################################################
-- ## Resource cards become admin-managed
-- ## source: /supabase/resources_admin_migration.sql
-- ###########################################################################

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


-- ###########################################################################
-- ## Per-member affiliation on the About page
-- ## source: /supabase/team_affiliation_migration.sql
-- ###########################################################################

-- ═══════════════════════════════════════════════════════════════════════════
-- HEAL-AI · make each team member's affiliation editable
-- ───────────────────────────────────────────────────────────────────────────
-- WHY
--   The line under a team member's name on the About page read
--   "<badge> · Stanford Health Care", with the institution hardcoded in
--   js/app.js. It could only be changed by editing code, and every member
--   was forced to show the same one — no way to credit a collaborator from
--   another institution.
--
-- WHAT THIS ADDS
--   A nullable `affiliation` column. Left null, the card falls back to
--   DEFAULT_AFFILIATION in js/data.js, so changing the institution for the
--   whole team is still a one-line edit in one place. Set it on a row and
--   that member overrides the default.
--
--   Nullable on purpose rather than backfilled with 'Stanford Health Care':
--   a null genuinely means "whatever the lab's default is" and keeps
--   following it, where a copied-in value would silently go stale the next
--   time the default changes.
--
-- SAFE TO RE-RUN
--   `if not exists` — running it twice does nothing the second time.
--
-- HOW TO RUN
--   Supabase dashboard → SQL Editor → paste this file → Run.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.team_members
  add column if not exists affiliation text;

comment on column public.team_members.affiliation is
  'Institution shown after the badge on the About page team card. Null means use DEFAULT_AFFILIATION from js/data.js.';


-- ###########################################################################
-- ## The 8 sample reports become admin-managed
-- ## source: /supabase/reports_admin_migration.sql
-- ###########################################################################

-- ═══════════════════════════════════════════════════════════════════════════
-- HEAL-AI · make the 8 sample reports admin-managed
-- ───────────────────────────────────────────────────────────────────────────
-- WHY
--   The 8 redacted sample reports were hardcoded in js/data.js
--   (RESOURCE_CATEGORIES' reports[] plus REPORT_DETAILS), so editing a
--   summary or adding a ninth meant a code change and a deploy. This is the
--   same move already done for resource cards in
--   /supabase/resources_admin_migration.sql.
--
-- WHAT CHANGES FOR THE SITE
--   js/app.js treats the `reports` table as authoritative as soon as it
--   holds a row, and ignores the static arrays entirely. Those arrays stay
--   behind only as a pre-migration / Supabase-unreachable fallback, so the
--   Sample Reports tab renders either way. Once this has run, edits must
--   happen in /admin.html → Sample Reports.
--
-- ABOUT THE FULL-REPORT FILES
--   The .docx for each report used to live on heal-ai.stanford.edu, which
--   now serves this site instead of Stanford's Drupal install, so those URLs
--   are dead. The rows below are seeded WITHOUT a file, which renders as
--   "Full report coming soon" on the detail pane. Attach each .docx through
--   the admin form when the files have a home.
--
--   `uploaded_by` is left null for the same reason as the resource seed:
--   these rows predate any admin account.
--
-- SAFE TO RE-RUN
--   The seed is skipped if any seeded row is already present, so running
--   twice will not duplicate reports or overwrite text edited since.
--
-- HOW TO RUN
--   Supabase dashboard → SQL Editor → paste this file → Run.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1. A seeded report has no uploader ──────────────────────────────────
alter table public.reports alter column uploaded_by drop not null;


-- ── 2. Admins need UPDATE, so reports can be edited rather than replaced ─
-- reports_team_schema.sql granted insert/delete only; without this the
-- admin edit form and the priority control silently no-op under RLS.
drop policy if exists "only admins can update reports" on public.reports;
create policy "only admins can update reports"
  on public.reports for update
  using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );


-- ── 3. Seed the 8 previously-hardcoded reports ──────────────────────────
-- Generated from js/data.js rather than retyped, so the text matches what
-- the site has been showing. Priorities descend by 10 to preserve the
-- original order while leaving room to slot a report between two others.
do $$
begin
  if exists (select 1 from public.reports where name = 'HeartRead') then
    raise notice 'Seed rows already present — skipping seed.';
    return;
  end if;

  insert into public.reports (name, sub, overview, summary, issues, priority) values
    ('HeartRead',
     'A predictive algorithm to screen for hypertrophic cardiomyopathy.',
     'This predictive AI tool, nicknamed HeartRead, seeks to improve diagnosis of hypertrophic cardiomyopathy (HCM), a common inherited heart condition that can be hard to detect but may cause sudden death. Though often symptomless, HCM can be treated effectively if caught early. HeartRead analyzes existing ECGs in patients'' medical record to help doctors identify potential cases that need follow-up with an echocardiogram to confirm a diagnosis of HCM. Trained on data from multiple medical centers, it has shown higher accuracy than cardiologists in early tests, though it can produce false positives.',
     'The benefits of the tool appear to outweigh the risks and stakeholders are enthusiastic about its potential to address a serious health condition; however, several areas of uncertainty require study before a deployment decision is made, including the tool''s overall performance, performance in patient subgroups, and overall value. Before deployment, the health system should also address workflow: outreach to PCPs to boost screening-ECG prevalence, adequate staffing of the Echo Lab and HCM clinic, and waiving confirmatory-testing fees for uninsured patients.',
     array['By identifying many new patients who could benefit from echocardiograms, the tool will intensify the current capacity strain on the Echo Lab and HCM clinic, increasing wait times for other patients.',
            'Because of the low prevalence of ECG screening, particularly in minoritized populations, the benefits offered by the tool are not equitably available to all patients.',
            'Additional information about the tool''s performance in patient subgroups is needed before deployment.',
            'Stakeholders were not aligned about the primary risk: design team members and clinicians focused on false positives, while patients were more concerned about false negatives.',
            'Most stakeholders do not feel patient consent for use of the tool is needed; however, information about the tool’s use should be provided to those who screen positive.'],
     80),

    ('NoteBuddy',
     'A large language model to generate nursing notes.',
     'This large language model, nicknamed NoteBuddy, aims to help nurses create end-of-shift summaries more efficiently. Currently, nurses spend 30–60 minutes after 12-hour shifts compiling notes from the EMR to ensure the incoming care team is fully informed. NoteBuddy is integrated into the EMR and scans notes, test results, and medications to generate draft summaries. Nurses are required to review and edit every draft before it becomes the final summary.',
     'The use case is promising, and ethical considerations do not militate against deployment. Stakeholders were generally optimistic about the potential to reduce nurses’ burden and improve patient care; none opposed its use. Remaining opportunities center on (1) design features that may elevate the risk of inaccuracies or omissions, and (2) the challenge of evaluating the tool’s benefits and burdens once deployed.',
     array['The tool may, by design, miss information that is important to clinicians or patients, negatively impacting quality of care.',
            'Avoiding unintended harm by correcting inaccuracies requires more human oversight than is likely to occur, or than is commensurate with reducing nurses’ workload.',
            'Nurses, who are held responsible for the accuracy and completeness of the notes, worry they might be asked to vouch for information in the LLM-generated draft they lack firsthand knowledge of.',
            'Long-term use of the tool could undermine nurses’ training and skill in identifying important information in the EMR and synthesizing it.'],
     70),

    ('AuthorizeMe',
     'A generative AI tool to help secure insurance prior authorizations.',
     'This large language model, nicknamed AuthorizeMe, is under consideration to streamline the insurance prior authorization (PA) process. Hospital financial staff currently prepare these requests manually, taking about 20 minutes each; because they are not clinically trained, key information in the EHR can be hard to find, leading to denials and care delays. AuthorizeMe automatically extracts patient information to populate PA forms and drafts answers to insurers’ medical questions, linking to source documents. Staff review and edit before submission. It is expected to cut preparation time by 25%.',
     'The prospective benefits appear to outweigh the risks and all stakeholders support moving forward. There is, however, a need for careful monitoring given uncertainty about whether financial staff, who have low familiarity with generative AI, can provide effective oversight of AI output. The ethics team''s chief recommendation is that the health system provide technical assistance to build a user training curriculum and a monitoring plan.',
     array['There is reason for concern about whether financial staff are sufficiently knowledgeable to know what to look for when reviewing output.',
            'PA request work is high-volume and repetitive, compounding the risk of missing errors and, over time, experiencing automation bias.',
            'Stakeholders expressed concerns about the potential workforce effects of the tool.',
            'Some patients and developers expressed uncertainty about whether the healthcare system''s training data are large and diverse enough to ensure equal performance across all kinds of PA requests.'],
     60),

    ('RadiRead',
     'A tool to help radiologists generate imaging reports.',
     'This large language model, nicknamed RadiRead, is designed to help radiologists generate imaging reports more efficiently. Each study typically takes 6–23 minutes to dictate, and radiologists may review over 100 studies per shift. RadiRead automatically generates the impression section of a radiology report from what the radiologist dictated in the findings section, highlighting key findings and recommending follow-up care. The radiologist reviews and edits it before finalizing the report.',
     'It is unclear to what extent the potential benefits will be realized, but implementation should proceed with appropriate monitoring because the prospective benefits appear to outweigh the risks. The primary risk is that, due to automation bias, clinically significant or embarrassing errors in the output will go undetected. The ethics team recommends the health system proceed only after concrete plans for user training and monitoring are submitted, that residents be excluded from use of the tool, and that the health system develop a patient-facing resource explaining how AI tools are used in care.',
     array['All stakeholder groups perceived the primary risk to be that LLM performance problems generate errors in the impressions and automation bias sets in among reviewing radiologists.',
            'Stakeholders expressed curiosity about the tool''s performance in medically complex cases.',
            'Multiple clinicians worried about de-skilling of residents, who would not learn to summarize, prioritize findings, and generate treatment recommendations themselves.',
            'The implementation team should propose a concrete plan for assessing the tool''s accuracy and any workload reductions.',
            'Some patients and clinicians expressed discomfort entrusting patient data to a third-party vendor on a promise of deidentification the health system could not directly verify.'],
     50),

    ('Copilot',
     'An ambient scribe tool to generate summary notes on clinic visits.',
     'This generative AI tool, nicknamed Copilot, helps doctors summarize patient visits. Doctors currently spend roughly twice as much time on EMR documentation as with patients, contributing to burnout. Copilot uses voice recognition and large language models to transcribe and summarize visit conversations, distinguishing among speakers and organizing summaries into key sections. Doctors still review and edit the AI-generated summaries before they’re added to the record.',
     'The use case is promising, and ethical considerations do not militate against deployment. Stakeholders, including patients, were enthusiastic about its potential to reduce documentation burden and improve physician-patient interactions. Ongoing evaluation should focus on: (1) better ascertainment of inaccuracies carrying risk of patient harm; (2) potential for lower performance for patients with limited or accented English, speech impediments, or complex visits; and (3) long-term risks of automation bias and de-skilling.',
     array['All stakeholders express generalized concern about possible bias, but even developers have poor visibility into actual performance for patient subgroups.',
            'Evaluating clinically significant inaccuracies will be challenging, partly for lack of a benchmark against which to compare the tool''s summaries.',
            'Clinicians have high optimism about the tool, which may heighten the risk of automation bias, and little interest in the adequacy of the training data.',
            'Correcting inaccuracies in draft summaries may require more human oversight than is likely to occur, given the goal of reducing physicians’ workload.',
            'It is unclear what information patients receive when asked for consent, especially concerning transmission and use of their data by the third-party vendor.'],
     40),

    ('Payment Probability & Denial Appeal Drafter',
     'LLMs predicting the likelihood of successfully challenging an insurance denial and drafting appeal letters.',
     'Two AI tools, Payment Probability (PP) and Denial Appeal Drafter (DAD), are being considered to improve how the Denials Management team handles denied insurance claims. PP assigns each denied claim a Likelihood of Payment score (0–100%) based on past claims and payment history, helping staff prioritize the most promising appeals. DAD then drafts the appeal letter itself, pulling clinical information from the denied visit and up to six months of related records, with citations linking to the supporting record. Both are powered by large language models; staff review and edit the output.',
     'For both tools, the prospective benefits of adoption appear to outweigh the risks, and stakeholders are enthusiastic about moving forward. The ethics team recommends deployment with safeguards focused on user training and performance evaluation. The primary risk is that inaccuracies in either tool''s output could lead to lower, not higher, rates of successfully reversing denials, and the ethics team is not confident current users could reliably detect and fix such errors without additional training.',
     array['The primary risk is that inaccuracies in the tools'' output could lead to lower, not higher, rates of reversing denials.',
            'Measuring the net benefit of each tool separately will be challenging since both operate in the same workflow.',
            'If use of the PP tool becomes widespread, it may create perverse incentives for insurers to deny claims more persistently.',
            'Patients worried that, over time, using the PP tool might make the health system less willing to care for patients with less favorable insurers.',
            'If the DAD tool hallucinates information the user does not catch before submission to a government payer, there could be legal implications.'],
     30),

    ('LabAlert',
     'An AI tool to help reduce low-value lab tests.',
     'This AI tool, nicknamed LabAlert, is designed to help reduce unnecessary lab testing for hospitalized patients. A significant portion of daily standing-order lab tests, especially repeated complete blood counts and chemistry panels, may not be clinically necessary after the first few days, yet can cause discomfort and disrupt sleep. LabAlert predicts whether a patient’s next test result is likely to be stable, using lab history, vital signs, and medications, and triggers an EHR notification prompting the doctor to reconsider the order.',
     'Stakeholders were consistently supportive of the tool, and patients were explicitly willing to trade a perceived low risk of missing something for a more comfortable, restful recovery. The top concern among developers and clinicians was that the model would underperform for patients with certain clinical profiles, underscoring the need to give physicians key information so they can make informed decisions about whether to accept an alert.',
     array['The top countervailing concern, voiced more by developers, clinicians, and experts than patients, was that the model would underperform for certain groups.',
            'All stakeholder groups recognized potential for automation bias, though none perceived it as high; alarm fatigue, intrinsic motivation, and accountability concerns seem likely to mitigate it.',
            'Stakeholders generally believed physicians should be informed of the model''s false-positive/false-negative rates, the nature of its training data, and patient characteristics or groups for whom it may underperform.'],
     20),

    ('SendOff',
     'An algorithm for predicting risk of hospital readmission.',
     'This random forest model, nicknamed SendOff, is designed to help reduce unplanned readmissions (patients returning within 3 days of discharge). SendOff generates a risk score that the discharge planning team can use to prioritize referrals to the health system’s Transition of Care program, which has limited capacity to support every patient after discharge. Physicians can still refer patients based on their own judgment; TOC staff make the final call on who receives post-discharge support.',
     'Overall, stakeholders other than developers had limited or no enthusiasm for proceeding. Two of four patients opposed it, both prospective clinical users expressed only guarded interest, and ethicists characterized it as an inappropriate response to the readmissions problem. Experts and most patients felt the tool omitted important risk factors and was unlikely to address the causes of readmissions, including suboptimal discharge planning. The ethics team’s assessment does not support use of the developer’s tool in either its original or updated version.',
     array['Stakeholders and experts expressed skepticism that the tool was the right solution to the problem.',
            'The tool only prioritizes among patients whom physicians have already referred to the program.',
            'The tool may underperform for patient subgroups at risk of readmission due to factors the model does not consider.',
            'Monitoring the tool''s performance over time should address the risk that its accuracy could degrade.'],
     10);

  raise notice 'Seeded 8 sample reports.';
end $$;


-- ###########################################################################
-- ## A featured flag on news items
-- ## source: /supabase/news_featured_migration.sql
-- ###########################################################################

-- ═══════════════════════════════════════════════════════════════════════════
-- HEAL-AI · let an admin pick which news item the spotlight features
-- ───────────────────────────────────────────────────────────────────────────
-- WHY
--   The News tab's featured bar had no control behind it. It showed whichever
--   seminar video carried `featured: true` in js/data.js — a flag only ever
--   set on a hardcoded entry — and otherwise just whatever sorted to the top.
--   So rotating the spotlight meant a code change, and only a seminar video
--   could ever appear there.
--
-- WHAT THIS ADDS
--   A `featured` boolean, plus a partial unique index that allows at most one
--   featured row at a time. The index is the real guarantee: the admin UI
--   clears the old pick before setting the new one, but if that ever ran out
--   of order — two tabs open, a half-finished request — the database refuses
--   the second row rather than leaving the site with two "featured" items and
--   no defined winner.
--
--   Any of the three feeds can be featured now, not just seminars;
--   renderNewsSpotlight() in app.js adapts its meta line and button to the
--   item's type.
--
-- SAFE TO RE-RUN
--   Both statements are `if not exists`.
--
-- HOW TO RUN
--   Supabase dashboard → SQL Editor → paste this file → Run.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.news_items
  add column if not exists featured boolean not null default false;

-- Partial index: only rows with featured = true participate, so any number
-- of rows may be false while at most one may be true.
create unique index if not exists news_items_single_featured
  on public.news_items (featured)
  where featured;

comment on column public.news_items.featured is
  'Exactly one row may be true. Drives the News tab spotlight; chosen from the picker at the top of /admin.html → News.';


-- ###########################################################################
-- ## Podcasts, thumbnails, and audio  <-- THE ONLY ONE STILL OUTSTANDING
-- ## source: /supabase/news_media_migration.sql
-- ###########################################################################

-- ═══════════════════════════════════════════════════════════════════════════
-- HEAL-AI · podcasts, thumbnails, and audio for the News tab
-- ───────────────────────────────────────────────────────────────────────────
-- WHY
--   The News tab is being rebuilt as "In the News" (a thumbnail grid of
--   videos / podcasts / articles with a detail pane) plus a separate
--   "Recent Publications" list. That needs a fourth item type and somewhere
--   to keep a thumbnail, a video embed, an audio file, and a transcript.
--
-- WHY SO LITTLE SCHEMA
--   Only the type check changes. The new per-type fields live in the
--   existing `meta` jsonb, which is already how this table stores
--   type-specific data (speaker/venue for a talk, source for an article,
--   authors/journal for a paper) and already how the admin form reads and
--   writes them — see collectNewsMeta() in js/admin.js. The keys are:
--
--     thumb       storage path in the news-media bucket, or an absolute URL
--     embed       video embed URL (YouTube /embed/… or Vimeo player URL)
--     audio       storage path in news-media, or an absolute URL, for a podcast
--     transcript  plain-text transcript, shown in a disclosure in the pane
--
--   A wide migration of nullable columns used by one type each would buy
--   nothing here: nothing filters or joins on them, they are only ever read
--   back with the row that owns them.
--
-- SAFE TO RE-RUN
--   Every statement is guarded.
--
-- HOW TO RUN
--   Supabase dashboard → SQL Editor → paste this file → Run.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1. Add 'podcast' to the allowed types ────────────────────────────────
do $$
declare cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.news_items'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%type%';
  if cname is not null then
    execute format('alter table public.news_items drop constraint %I', cname);
  end if;
end $$;

alter table public.news_items add constraint news_items_type_check
  check (type in ('seminar_video', 'podcast', 'news_article', 'scholarly_publication'));


-- ── 2. A public bucket for thumbnails and podcast audio ─────────────────
-- Created here rather than in the dashboard so running this file is the
-- only setup step. `public` means anyone can READ an object; writing is
-- still gated by the policies below.
insert into storage.buckets (id, name, public)
values ('news-media', 'news-media', true)
on conflict (id) do nothing;

-- Same policy shape as resource-files and team-photos in the other
-- migrations: world-readable, admin-only writes.
drop policy if exists "news-media is publicly readable" on storage.objects;
create policy "news-media is publicly readable"
  on storage.objects for select
  using (bucket_id = 'news-media');

drop policy if exists "admins can upload news-media" on storage.objects;
create policy "admins can upload news-media"
  on storage.objects for insert
  with check (
    bucket_id = 'news-media'
    and exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

drop policy if exists "admins can delete news-media" on storage.objects;
create policy "admins can delete news-media"
  on storage.objects for delete
  using (
    bucket_id = 'news-media'
    and exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

comment on column public.news_items.meta is
  'Type-specific fields. Talks: speaker, venue. Articles: source. Papers: authors, journal. Any of them may also carry thumb / embed / audio / transcript — see /supabase/news_media_migration.sql.';

