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
