/*
═════════════════════════════════════════════════════════════════════════════
 HEAL-AI · js/data.js
─────────────────────────────────────────────────────────────────────────────
 PURPOSE
   The "Content Engine". Every piece of editable copy on the site —
   headlines, button labels, video metadata, the 8 sample reports, the
   patient panel guide, the 5-step Get Started flow, the FURM steps,
   the team grid — lives in this file as plain JS objects/arrays.

 EDIT-HERE PHILOSOPHY
   • Non-engineers can update copy by editing strings here and refreshing.
   • DOM IDs, classes, and behavior are NEVER referenced from this file.
     If you want to change WHERE something renders, edit app.js/index.html.
     If you want to change WHAT it says, edit this file.

 GLOBAL SCOPE
   These constants are read by app.js via window scope. Same rationale as
   config.js: no bundler, no imports — make hand-editing painless.

 SCHEMA OVERVIEW
   ① NAV_ITEMS .............. tab labels + routing IDs
   ② HERO_COPY .............. headline / sub / buttons on home hero
   ③ HOME_ABOUT ............. positioning statement + 3 pillars
   ④ STATS .................. 3 stats under the hero
   ⑤ GET_STARTED_STEPS ...... 5-card flow (Watch → Learn → Download → Adapt → Sign up)
   ⑥ FURM_STEPS ............. 5-step process methodology
   ⑦ VIDEOS ................. 6-part training series (Phase 2)
   ⑧ RESOURCE_CATEGORIES .... tabbed library, includes the 8 sample reports
   ⑧b RESOURCE_GROUPS ....... Templates/Sample Reports Level-2 tabs
   ⑨ PP_STATS / PP_STANFORD / PP_EXTERNAL  ... patient partner panel content
   ⑩ PLAYBOOK_SECTIONS ...... 2-part internal process accordion + considerations
   ⑪ (removed — team roster now lives entirely in Supabase's team_members table)
   ⑫ ABOUT_CARDS ............ "How we got here" / "What we believe"
   ⑬ PAPERS ................. hover content for the hero canvas research nodes
   ⑭ ICONS .................. inline-SVG icon library
   ⑮ SEMINAR_VIDEOS / NEWS_ARTICLES / SCHOLARLY_PUBLICATIONS ... News tab feeds

 ACCESSIBILITY (a11y) REMINDER
   • String values may contain <strong>, <em>, or HTML entities. They're
     written into innerHTML in app.js so HTML works, but DO NOT paste
     untrusted/user-supplied strings here — this is editorial content
     authored by the HEAL-AI team. Treat the file like a CMS.
═════════════════════════════════════════════════════════════════════════════
*/


/* ─────────────────────────────────────────────────────────────────────────
   ① NAV_ITEMS · order and labels for the top navigation
─────────────────────────────────────────────────────────────────────────────
   `id` must match a <section class="page" id="page-XXX">.
   `videoOnly: true` makes the item appear ONLY when SHOW_VIDEOS is true.

   EDIT HERE  →  rename labels or reorder items by editing this array.
─────────────────────────────────────────────────────────────────────────── */
const NAV_ITEMS = [
  { id: 'home',    label: 'Home' },
  { id: 'toolkit', label: 'Toolkit' },
  { id: 'videos',  label: 'Videos',    videoOnly: true },
  { id: 'patient', label: 'Patient Panel' },
  { id: 'about',   label: 'About' },
  { id: 'news',    label: 'News' },
];


/* ─────────────────────────────────────────────────────────────────────────
   ② HERO_COPY · home page hero block
─────────────────────────────────────────────────────────────────────────────
   `headline` supports HTML — wrap accent words in <em> to apply the cardinal
   italic emphasis style. `buttons[].action` maps to behavior in app.js:
     "page:XXX"  → goPage('XXX')
     "url"       → opens buttons[].url in a new tab
─────────────────────────────────────────────────────────────────────────── */
const HERO_COPY = {
  eyebrow: 'The human layer of AI governance',
  headline: 'Your AI governance focuses on the model. <em>We spot problems that arise when people use it.</em>',
  sub: 'The HEAL-AI Lab provides resources for healthcare organizations to do fast but robust ethical review of AI tools focusing on the issues that matter most to patients and staff.',
  buttons: [
    { label: 'See the process →', action: 'page:toolkit',           variant: 'prime' },
    { label: 'Browse resources',  action: 'page:toolkit:resources', variant: 'second' },
  ],
};


/* ─────────────────────────────────────────────────────────────────────────
   ③ HOME_ABOUT · positioning statement + 3 pillars
─────────────────────────────────────────────────────────────────────────────
   `statement` supports HTML for the cardinal-italic emphasis treatment.
   `bullets` accepts any number of pillar cards — the layout flexes.
─────────────────────────────────────────────────────────────────────────── */
const HOME_ABOUT = {
  statement: "Workflow friction. Conflicting values. Gaps between good intentions and what's likely to happen in practice. None of it shows up in a monitoring dashboard, <em>it shows up when we talk to the people closest to the tool.</em> Our process sits alongside the AI governance you already have, to help you to make the call: move forward, modify plans, or decline.",
  bullets: [
    { title: 'Fair, Useful, Reliable',
      body: "Grounded in Stanford's broader AI governance process, known as FURM." },
    { title: 'Inclusive of Patients',
      body: 'Train and engage patients to help assess uses of AI.' },
    { title: 'Adaptable',
      body: 'Templates &amp; playbook designed for cross-institutional use.' },
  ],
};


/* ─────────────────────────────────────────────────────────────────────────
   ④ STATS · the 3-stat band beneath the hero
─────────────────────────────────────────────────────────────────────────── */
/* Single source of truth for the count of AI tools evaluated — shown on the
   home page stats band and again as "Tools reviewed" on the patient page.
   Update it here and both places stay in sync. */
const TOOLS_EVALUATED = '20+';

/* Institution shown after the badge on every About page team card —
   "Director · Stanford Health Care". Change it here to move the whole team
   at once. A member who isn't at this institution can override it with the
   Affiliation field in /admin.html → Team, which fills
   team_members.affiliation (see /supabase/team_affiliation_migration.sql);
   anyone left blank follows this value. */
const DEFAULT_AFFILIATION = 'Stanford Health Care';

const STATS = [
  { n: TOOLS_EVALUATED,  label: 'AI tools evaluated across <strong>Stanford Health Care</strong>' },
  { n: '100%', label: 'of evaluations include <strong>structured patient input</strong>' },
  { n: '15',   label: '<strong>redacted sample reports</strong> in the resource library' },
];


/* ─────────────────────────────────────────────────────────────────────────
   ⑤ GET_STARTED_STEPS · the 5-card flow on the home page
─────────────────────────────────────────────────────────────────────────────
   `action` controls what happens when the card is clicked / Enter-pressed:
     "page:XXX"  → routes to that page
     "url"      → opens SIGN_UP_URL (this is the "Sign up" step)
─────────────────────────────────────────────────────────────────────────── */
const GET_STARTED_STEPS = [
  { n: '01', icon: 'video',    title: 'Watch the videos',
    desc: 'A six-part training series introduces FURM, the ethics assessment process, and patient panel facilitation.',
    action: 'page:videos' },
  { n: '02', icon: 'route',    title: 'Learn the process',
    desc: 'Walk through Intake → Stakeholder Interviewing → Expert Vetting → Delivery with worked examples.',
    action: 'page:toolkit' },
  { n: '03', icon: 'download', title: 'Download resources',
    desc: 'Templates, interview guides, focus-group materials, and redacted sample reports.',
    action: 'page:toolkit:resources' },
  { n: '04', icon: 'book',     title: 'Use the playbook',
    desc: 'Your companion in setting up the process and assessing different types of AI tools.',
    action: 'page:toolkit:playbook' },
  { n: '05', icon: 'mail',     title: 'Sign up for updates',
    desc: "Subscribe so you know when new ethics reports and other materials go live.",
    action: 'url' },
];


/* ─────────────────────────────────────────────────────────────────────────
   ⑥ FURM_STEPS · the 5-step evaluation methodology
─────────────────────────────────────────────────────────────────────────────
   `gates` is a small visual indicator (filled dots) showing cumulative
   progress. Keep its length aligned with the step number.
─────────────────────────────────────────────────────────────────────────── */
const FURM_STEPS = [
  { n: '01', title: 'Intake',
    desc: 'A proposing team submits the AI use case for review. We capture background, intended use, stakeholder information and the deployment timeline.',
    gates: 1 },
  { n: '02', title: 'Stakeholder Interviews',
    desc: 'Structured interviews with stakeholders such as developers, clinical users, support staff, and patients.',
    gates: 2 },
  { n: '03', title: 'Analysis',
    desc: "Interviews are analyzed and places where stakeholders' values conflict are identified.",
    gates: 3 },
  { n: '04', title: 'Report Review',
    desc: 'Experts review the report and identify gaps in our assessments.',
    gates: 4 },
  { n: '05', title: 'Report Delivery',
    desc: 'The written report is shared with leadership and proposing teams.',
    gates: 5 },
];


/* ─────────────────────────────────────────────────────────────────────────
   ⑦ VIDEOS · the 6-part training series
─────────────────────────────────────────────────────────────────────────────
   • `embed` is the iframe URL. For YouTube, use the /embed/{id} form.
     For Vimeo, use https://player.vimeo.com/video/{id}.
   • `resources` is a list of short chip labels that link the user back to
     the Toolkit page's Resources tab (chip handler in app.js).
   • These don't render at all when SHOW_VIDEOS is false (Phase 1).

   EDIT HERE  →  drop in the real embed URLs once the videos are uploaded.
─────────────────────────────────────────────────────────────────────────── */
const VIDEOS = [
  { id: 'v1', num: '01', title: 'Welcome to HEAL-AI', duration: '8:42',
    desc: 'Why centralized, ethics-grounded AI evaluation matters, and what this toolkit covers.',
    embed: 'https://www.youtube.com/embed/REPLACE_ID',
    resources: ['Overview deck', 'Glossary', 'Intake template'] },

  { id: 'v2', num: '02', title: 'The FURM Framework', duration: '14:21',
    desc: 'A deep dive on Fair, Useful, Reliable Models, the analytic spine of every evaluation.',
    embed: 'https://www.youtube.com/embed/REPLACE_ID',
    resources: ['FURM whitepaper'] },

  { id: 'v3', num: '03', title: 'Running Stakeholder Interviews', duration: '19:08',
    desc: 'Field-tested guides for interviewing developers, clinical users, and operational owners.',
    embed: 'https://www.youtube.com/embed/REPLACE_ID',
    resources: ['Developer guide', 'User guide', 'Thematic analysis template'] },

  { id: 'v4', num: '04', title: 'The Patient Partner Panel', duration: '17:55',
    desc: 'Recruiting, training, and running a patient panel, and what it changes in practice.',
    embed: 'https://www.youtube.com/embed/REPLACE_ID',
    resources: ['Moderator guide', 'Recruitment script', 'Compensation template'] },

  { id: 'v5', num: '05', title: 'Writing &amp; Delivering the EOP', duration: '12:34',
    desc: 'How the Ethics &amp; Operations Plan is structured, shared, and used by leadership.',
    embed: 'https://www.youtube.com/embed/REPLACE_ID',
    resources: ['EOP template', 'Sample report: HeartRead', 'Sample report: NoteBuddy'] },

  { id: 'v6', num: '06', title: 'Adapting at Your Institution', duration: '15:46',
    desc: 'Right-sizing the process for your governance structure, IT, and patient community.',
    embed: 'https://www.youtube.com/embed/REPLACE_ID',
    resources: ['Playbook (preview)', 'Adaptation worksheet'] },
];


/* ─────────────────────────────────────────────────────────────────────────
   ⑧ RESOURCE_CATEGORIES · the tabbed Resources page
─────────────────────────────────────────────────────────────────────────────
   Each category is one tab. Inside each:
     • `intro`     → big heading + paragraph + "How to use" side card
     • `items[]`   → cards. state='ready' shows a live link via `href`;
                     state='soon'  shows a dashed "Coming soon" card.
     • `reports[]` (only on the "reports" category) → the 8 redacted
                     sample reports rendered as a dense grid.

   ⚠ `items[]` IS NO LONGER WHERE YOU EDIT CARDS.
   Resource cards are admin-managed now: they live in Supabase's `resources`
   table and are added, re-ordered, and deleted from /admin.html. As soon as
   that table holds one row it wins outright and everything in these items[]
   arrays is ignored — see getPublicResources() in app.js.

   These arrays survive as the fallback for exactly two situations: Supabase
   being unreachable, and /supabase/resources_admin_migration.sql not having
   been run yet (that file seeds these same 12 cards as rows). Keep them
   roughly in sync if you like, but a change here will NOT show up on a
   normal, migrated deployment.

   None of the fallback items carry an href any more, so they all render as
   "Coming soon". That is deliberate: the real files now live in Supabase
   Storage, and the only time this fallback is used is when Supabase is
   unreachable — in which case those Storage URLs would be unreachable too.
   A dimmed card is honest there; a link to a host we already know is down
   is not.

   `intro` copy and the category list itself are still edited here.
   The 8 SAMPLE REPORTS are the spec-required deliverables — keep all 8.

   PROVENANCE NOTE (migrated content)
     Items below marked with a trailing "migrated from heal-ai.stanford.edu"
     comment were pulled from the live Stanford site's /resources page and
     slotted into whichever existing tab already matched their topic. Where
     no real content existed for a placeholder (still `href:'#'`), the
     placeholder was left untouched rather than invented. `state:'soon'`
     items reflect the source site's own "Coming soon" labels, not ours.
─────────────────────────────────────────────────────────────────────────── */
const RESOURCE_CATEGORIES = [
  /* ─ Tab 1 ─ Running Stakeholder Interviews ────────────────────────── */
  {
    id: 'interviews',
    icon: 'people',
    label: 'Running Stakeholder Interviews',
    intro: {
      h: 'Efficiently learn what matters to those affected by the AI — patients, users, clinical champions, and digital services administrators.',
      p: 'Question banks, scheduling templates, and thematic-analysis guides to help with interviews and data evaluation.',
      bullets: ['Pull the interview guides', 'Use the thematic template'],
    },
    items: [
      { h: 'Interview guides for different stakeholders', icon: 'mic', state: 'soon',
        sub: 'Template guide for interviews with proposers or developers of the AI use case.' }, /* migrated from heal-ai.stanford.edu */
      { h: 'Interview guide for prospective tool users', icon: 'mic', state: 'soon',
        sub: 'Template interview guide for clinicians expected to use the tool, customizable per use case.' }, /* migrated from heal-ai.stanford.edu */
      { h: 'Thematic analysis template',   icon: 'sheet', state: 'soon',
        sub: 'Template for thematic content analysis of interview and focus group transcripts.' }, /* migrated from heal-ai.stanford.edu */
      { h: 'Interview &amp; focus group tracking sheet', icon: 'cal', state: 'soon',
        sub: 'Spreadsheet for tracking progress of stakeholder interviews and the patient focus group.' }, /* migrated from heal-ai.stanford.edu */
      { h: '&ldquo;What to Expect&rdquo; guide for use-case submissions', icon: 'paper', state: 'soon',
        sub: 'What teams should expect when submitting a proposed use case for ethical assessment.' }, /* migrated from heal-ai.stanford.edu */
      { h: 'Expert Oversight Panel meeting template', icon: 'paper', state: 'soon',
        sub: 'Template for structuring meetings with the Expert Oversight Panel.' }, /* migrated from heal-ai.stanford.edu */
    ],
  },

  /* ─ Tab 3 ─ Running a Patient Partner Group ───────────────────────── */
  {
    id: 'panel',
    icon: 'people',
    label: 'Running a Patient Partner Group',
    intro: {
      h: 'Bring patient voice into the room.',
      p: 'How we recruit, train, and run our volunteer panel, and the facilitation artifacts you need to do the same.',
      bullets: ["Read Stanford's model", "Use the moderator's guide", 'Pair with Video 04'],
    },
    items: [
      { h: "Moderator's guide",                icon: 'mic',   state: 'soon',
        sub: "Template patient focus group moderator's guide, customizable per use case." }, /* refined from heal-ai.stanford.edu */
      { h: 'Recruitment script',               icon: 'mail',  state: 'ready', href: '#',
        sub: 'Outreach language used with the Stanford patient council.' },
      { h: 'Fundamentals training curriculum', icon: 'book',  state: 'ready', href: '#',
        sub: '8-hour onboarding for new patient partners.' },
      { h: 'Compensation &amp; consent template', icon: 'paper', state: 'ready', href: '#',
        sub: 'Compensation rates, consent language, IRB notes.' },
      { h: 'What should patients be told about AI use?', icon: 'link', state: 'ready',
        href: 'https://healthpolicy.fsi.stanford.edu/news/ethical-obligations-inform-patients-about-use-ai-tools',
        sub: "HEAL-AI's JAMA commentary on how health systems should answer: ask, tell, or neither?" }, /* migrated from heal-ai.stanford.edu */
    ],
  },

  /* ─ Tab 4 ─ Writing & Delivering Your Report ───────────────────────
       This tab uniquely includes a `reports` array which renders the
       8 redacted sample reports beneath the resource cards.
     ─────────────────────────────────────────────────────────────────── */
  {
    id: 'reports',
    icon: 'paper',
    label: 'Writing &amp; Delivering Your Report',
    intro: {
      h: 'The Ethics Report, end-to-end.',
      p: 'The blank template we write every ethics report into.',
      bullets: ['Use the template', 'Reference the sample reports'],
    },
    items: [
      { h: 'Template for Report', icon: 'paper', state: 'ready', href: '#',
        sub: 'Blank Report Template' },
    ],
    /* ⚠ FALLBACK ONLY, like items[] above. The sample reports are
       admin-managed now: they live in Supabase's `reports` table and are
       added, edited, re-ordered, and deleted from /admin.html → Sample
       Reports. Once that table holds one row it wins outright and this
       array plus REPORT_DETAILS below are ignored — see
       getPublicReports() in app.js and
       /supabase/reports_admin_migration.sql, which seeds these same 8.

       `href` pointed at each report's page on the old Drupal site and is
       dead; nothing renders it (the browser uses data-code), so it is kept
       only as a record of where the content came from. */
    reports: [
      { code: '01', name: 'HeartRead', href: 'https://heal-ai.stanford.edu/hcm-ethical-assessment',
        sub: 'A predictive algorithm to screen for hypertrophic cardiomyopathy.' },
      { code: '02', name: 'NoteBuddy', href: 'https://heal-ai.stanford.edu/nursing-notes-summarization-large-language-model-generate-nursing-notes',
        sub: 'A large language model to generate nursing notes.' },
      { code: '03', name: 'AuthorizeMe', href: 'https://heal-ai.stanford.edu/authorizeme-ethics-assessment',
        sub: 'A generative AI tool to help secure insurance prior authorizations.' },
      { code: '04', name: 'RadiRead', href: 'https://heal-ai.stanford.edu/radiread',
        sub: 'A tool to help radiologists generate imaging reports.' },
      { code: '05', name: 'Copilot', href: 'https://heal-ai.stanford.edu/dax-copilot-ethical-assessment',
        sub: 'An ambient scribe tool to generate summary notes on clinic visits.' },
      { code: '06', name: 'Payment Probability &amp; Denial Appeal Drafter', href: 'https://heal-ai.stanford.edu/pp-and-dd',
        sub: 'LLMs predicting the likelihood of successfully challenging an insurance denial and drafting appeal letters.' },
      { code: '07', name: 'LabAlert', href: 'https://heal-ai.stanford.edu/lvlt',
        sub: 'An AI tool to help reduce low-value lab tests.' },
      { code: '08', name: 'SendOff', href: 'https://heal-ai.stanford.edu/sendoff',
        sub: 'An algorithm for predicting risk of hospital readmission.' },
    ],
  },

];


/* ─────────────────────────────────────────────────────────────────────────
   ⑧b RESOURCE_GROUPS · Level-2 tabs inside the Toolkit tab's Resources
   panel (Templates / Sample Reports).
─────────────────────────────────────────────────────────────────────────────
   Each entry is one Level-2 tab. `categoryIds` points back at
   RESOURCE_CATEGORIES entries by `id` — the categories themselves are
   untouched; this array only controls how they're grouped and labeled.
   A group with more than one categoryId renders each category as a
   labeled sub-section stacked inside that tab's panel, rather than as
   its own tab (see renderToolkitResources() in app.js).

   EDIT HERE  →  reorder groups, or move a category to a different group,
   by editing categoryIds. Do not duplicate a categoryId across groups.
─────────────────────────────────────────────────────────────────────────── */
const RESOURCE_GROUPS = [
  { id: 'templates', icon: 'deck',  label: 'Templates',
    categoryIds: ['interviews'] },
  /* NOTE · the 'panel' category is intentionally absent from every group.
     It renders on the Patient Panel page instead — see
     renderPatientResources() in app.js. Adding it back to a group here
     would make those cards appear in both places. */
  /* The "Guides" tab was removed by request, along with the two categories
     it held ('understand' and 'adapt'). */
  { id: 'reports',   icon: 'paper', label: 'Sample Reports',
    categoryIds: ['reports'] },
];


/* ─────────────────────────────────────────────────────────────────────────
   REPORT_DETAILS · full content behind each of the 8 sample-report cards
─────────────────────────────────────────────────────────────────────────────
   Migrated from each report's dedicated page on heal-ai.stanford.edu
   (Tool Overview / Report Summary / Key Issues Identified / Download Full
   Report). Rendered in an in-site modal (openReportDetail() in app.js) so
   visitors read the real content here instead of being redirected off-site
   — the external link only remains as `reports[].href` for reference.

   ⚠ FALLBACK ONLY — the `reports` table is the source of truth once it
   has rows. See the note on reports[] above.

   `downloadHref` is empty on all 8 as of 2026-09-15. heal-ai.stanford.edu
   now serves THIS site (GitHub Pages took the domain over from the old
   Drupal install), so the .docx files those links pointed at are gone.
   reportDetailHTML() renders an empty downloadHref as an inert "Full
   report coming soon" rather than a link that 404s. Attach each file
   through /admin.html → Sample Reports when they have a new home.

   Keyed by the same `code` used in RESOURCE_CATEGORIES' reports[] above.
─────────────────────────────────────────────────────────────────────────── */
const REPORT_DETAILS = {
  '01': {
    overview: "This predictive AI tool, nicknamed HeartRead, seeks to improve diagnosis of hypertrophic cardiomyopathy (HCM), a common inherited heart condition that can be hard to detect but may cause sudden death. Though often symptomless, HCM can be treated effectively if caught early. HeartRead analyzes existing ECGs in patients' medical record to help doctors identify potential cases that need follow-up with an echocardiogram to confirm a diagnosis of HCM. Trained on data from multiple medical centers, it has shown higher accuracy than cardiologists in early tests, though it can produce false positives.",
    summary: "The benefits of the tool appear to outweigh the risks and stakeholders are enthusiastic about its potential to address a serious health condition; however, several areas of uncertainty require study before a deployment decision is made, including the tool's overall performance, performance in patient subgroups, and overall value. Before deployment, the health system should also address workflow: outreach to PCPs to boost screening-ECG prevalence, adequate staffing of the Echo Lab and HCM clinic, and waiving confirmatory-testing fees for uninsured patients.",
    issues: [
      'By identifying many new patients who could benefit from echocardiograms, the tool will intensify the current capacity strain on the Echo Lab and HCM clinic, increasing wait times for other patients.',
      'Because of the low prevalence of ECG screening, particularly in minoritized populations, the benefits offered by the tool are not equitably available to all patients.',
      "Additional information about the tool's performance in patient subgroups is needed before deployment.",
      'Stakeholders were not aligned about the primary risk: design team members and clinicians focused on false positives, while patients were more concerned about false negatives.',
      'Most stakeholders do not feel patient consent for use of the tool is needed; however, information about the tool’s use should be provided to those who screen positive.',
    ],
    downloadHref: '',
  },
  '02': {
    overview: 'This large language model, nicknamed NoteBuddy, aims to help nurses create end-of-shift summaries more efficiently. Currently, nurses spend 30–60 minutes after 12-hour shifts compiling notes from the EMR to ensure the incoming care team is fully informed. NoteBuddy is integrated into the EMR and scans notes, test results, and medications to generate draft summaries. Nurses are required to review and edit every draft before it becomes the final summary.',
    summary: 'The use case is promising, and ethical considerations do not militate against deployment. Stakeholders were generally optimistic about the potential to reduce nurses’ burden and improve patient care; none opposed its use. Remaining opportunities center on (1) design features that may elevate the risk of inaccuracies or omissions, and (2) the challenge of evaluating the tool’s benefits and burdens once deployed.',
    issues: [
      'The tool may, by design, miss information that is important to clinicians or patients, negatively impacting quality of care.',
      'Avoiding unintended harm by correcting inaccuracies requires more human oversight than is likely to occur, or than is commensurate with reducing nurses’ workload.',
      'Nurses, who are held responsible for the accuracy and completeness of the notes, worry they might be asked to vouch for information in the LLM-generated draft they lack firsthand knowledge of.',
      'Long-term use of the tool could undermine nurses’ training and skill in identifying important information in the EMR and synthesizing it.',
    ],
    downloadHref: '',
  },
  '03': {
    overview: 'This large language model, nicknamed AuthorizeMe, is under consideration to streamline the insurance prior authorization (PA) process. Hospital financial staff currently prepare these requests manually, taking about 20 minutes each; because they are not clinically trained, key information in the EHR can be hard to find, leading to denials and care delays. AuthorizeMe automatically extracts patient information to populate PA forms and drafts answers to insurers’ medical questions, linking to source documents. Staff review and edit before submission. It is expected to cut preparation time by 25%.',
    summary: "The prospective benefits appear to outweigh the risks and all stakeholders support moving forward. There is, however, a need for careful monitoring given uncertainty about whether financial staff, who have low familiarity with generative AI, can provide effective oversight of AI output. The ethics team's chief recommendation is that the health system provide technical assistance to build a user training curriculum and a monitoring plan.",
    issues: [
      'There is reason for concern about whether financial staff are sufficiently knowledgeable to know what to look for when reviewing output.',
      'PA request work is high-volume and repetitive, compounding the risk of missing errors and, over time, experiencing automation bias.',
      'Stakeholders expressed concerns about the potential workforce effects of the tool.',
      "Some patients and developers expressed uncertainty about whether the healthcare system's training data are large and diverse enough to ensure equal performance across all kinds of PA requests.",
    ],
    downloadHref: '',
  },
  '04': {
    overview: 'This large language model, nicknamed RadiRead, is designed to help radiologists generate imaging reports more efficiently. Each study typically takes 6–23 minutes to dictate, and radiologists may review over 100 studies per shift. RadiRead automatically generates the impression section of a radiology report from what the radiologist dictated in the findings section, highlighting key findings and recommending follow-up care. The radiologist reviews and edits it before finalizing the report.',
    summary: "It is unclear to what extent the potential benefits will be realized, but implementation should proceed with appropriate monitoring because the prospective benefits appear to outweigh the risks. The primary risk is that, due to automation bias, clinically significant or embarrassing errors in the output will go undetected. The ethics team recommends the health system proceed only after concrete plans for user training and monitoring are submitted, that residents be excluded from use of the tool, and that the health system develop a patient-facing resource explaining how AI tools are used in care.",
    issues: [
      'All stakeholder groups perceived the primary risk to be that LLM performance problems generate errors in the impressions and automation bias sets in among reviewing radiologists.',
      "Stakeholders expressed curiosity about the tool's performance in medically complex cases.",
      'Multiple clinicians worried about de-skilling of residents, who would not learn to summarize, prioritize findings, and generate treatment recommendations themselves.',
      "The implementation team should propose a concrete plan for assessing the tool's accuracy and any workload reductions.",
      'Some patients and clinicians expressed discomfort entrusting patient data to a third-party vendor on a promise of deidentification the health system could not directly verify.',
    ],
    downloadHref: '',
  },
  '05': {
    overview: 'This generative AI tool, nicknamed Copilot, helps doctors summarize patient visits. Doctors currently spend roughly twice as much time on EMR documentation as with patients, contributing to burnout. Copilot uses voice recognition and large language models to transcribe and summarize visit conversations, distinguishing among speakers and organizing summaries into key sections. Doctors still review and edit the AI-generated summaries before they’re added to the record.',
    summary: 'The use case is promising, and ethical considerations do not militate against deployment. Stakeholders, including patients, were enthusiastic about its potential to reduce documentation burden and improve physician-patient interactions. Ongoing evaluation should focus on: (1) better ascertainment of inaccuracies carrying risk of patient harm; (2) potential for lower performance for patients with limited or accented English, speech impediments, or complex visits; and (3) long-term risks of automation bias and de-skilling.',
    issues: [
      'All stakeholders express generalized concern about possible bias, but even developers have poor visibility into actual performance for patient subgroups.',
      "Evaluating clinically significant inaccuracies will be challenging, partly for lack of a benchmark against which to compare the tool's summaries.",
      'Clinicians have high optimism about the tool, which may heighten the risk of automation bias, and little interest in the adequacy of the training data.',
      'Correcting inaccuracies in draft summaries may require more human oversight than is likely to occur, given the goal of reducing physicians’ workload.',
      'It is unclear what information patients receive when asked for consent, especially concerning transmission and use of their data by the third-party vendor.',
    ],
    downloadHref: '',
  },
  '06': {
    overview: 'Two AI tools, Payment Probability (PP) and Denial Appeal Drafter (DAD), are being considered to improve how the Denials Management team handles denied insurance claims. PP assigns each denied claim a Likelihood of Payment score (0–100%) based on past claims and payment history, helping staff prioritize the most promising appeals. DAD then drafts the appeal letter itself, pulling clinical information from the denied visit and up to six months of related records, with citations linking to the supporting record. Both are powered by large language models; staff review and edit the output.',
    summary: "For both tools, the prospective benefits of adoption appear to outweigh the risks, and stakeholders are enthusiastic about moving forward. The ethics team recommends deployment with safeguards focused on user training and performance evaluation. The primary risk is that inaccuracies in either tool's output could lead to lower, not higher, rates of successfully reversing denials, and the ethics team is not confident current users could reliably detect and fix such errors without additional training.",
    issues: [
      "The primary risk is that inaccuracies in the tools' output could lead to lower, not higher, rates of reversing denials.",
      'Measuring the net benefit of each tool separately will be challenging since both operate in the same workflow.',
      'If use of the PP tool becomes widespread, it may create perverse incentives for insurers to deny claims more persistently.',
      'Patients worried that, over time, using the PP tool might make the health system less willing to care for patients with less favorable insurers.',
      'If the DAD tool hallucinates information the user does not catch before submission to a government payer, there could be legal implications.',
    ],
    downloadHref: '',
  },
  '07': {
    overview: 'This AI tool, nicknamed LabAlert, is designed to help reduce unnecessary lab testing for hospitalized patients. A significant portion of daily standing-order lab tests, especially repeated complete blood counts and chemistry panels, may not be clinically necessary after the first few days, yet can cause discomfort and disrupt sleep. LabAlert predicts whether a patient’s next test result is likely to be stable, using lab history, vital signs, and medications, and triggers an EHR notification prompting the doctor to reconsider the order.',
    summary: 'Stakeholders were consistently supportive of the tool, and patients were explicitly willing to trade a perceived low risk of missing something for a more comfortable, restful recovery. The top concern among developers and clinicians was that the model would underperform for patients with certain clinical profiles, underscoring the need to give physicians key information so they can make informed decisions about whether to accept an alert.',
    issues: [
      'The top countervailing concern, voiced more by developers, clinicians, and experts than patients, was that the model would underperform for certain groups.',
      'All stakeholder groups recognized potential for automation bias, though none perceived it as high; alarm fatigue, intrinsic motivation, and accountability concerns seem likely to mitigate it.',
      "Stakeholders generally believed physicians should be informed of the model's false-positive/false-negative rates, the nature of its training data, and patient characteristics or groups for whom it may underperform.",
    ],
    downloadHref: '',
  },
  '08': {
    overview: 'This random forest model, nicknamed SendOff, is designed to help reduce unplanned readmissions (patients returning within 3 days of discharge). SendOff generates a risk score that the discharge planning team can use to prioritize referrals to the health system’s Transition of Care program, which has limited capacity to support every patient after discharge. Physicians can still refer patients based on their own judgment; TOC staff make the final call on who receives post-discharge support.',
    summary: 'Overall, stakeholders other than developers had limited or no enthusiasm for proceeding. Two of four patients opposed it, both prospective clinical users expressed only guarded interest, and ethicists characterized it as an inappropriate response to the readmissions problem. Experts and most patients felt the tool omitted important risk factors and was unlikely to address the causes of readmissions, including suboptimal discharge planning. The ethics team’s assessment does not support use of the developer’s tool in either its original or updated version.',
    issues: [
      'Stakeholders and experts expressed skepticism that the tool was the right solution to the problem.',
      'The tool only prioritizes among patients whom physicians have already referred to the program.',
      'The tool may underperform for patient subgroups at risk of readmission due to factors the model does not consider.',
      "Monitoring the tool's performance over time should address the risk that its accuracy could degrade.",
    ],
    downloadHref: '',
  },
};


/* ─────────────────────────────────────────────────────────────────────────
   ⑨ PATIENT PANEL CONTENT
─────────────────────────────────────────────────────────────────────────────
   The /patient page is split into two halves:
     • PP_STATS / PP_STANFORD_LIST = the left column (Stanford's panel)
     • PP_EXTERNAL                 = the right column (how to build one)

   The external column renders as an accordion. By default the FIRST item
   is expanded — this is controlled in app.js → renderPatient().
─────────────────────────────────────────────────────────────────────────── */
const PP_STATS = [
  { n: '13', label: 'Volunteer partners' },
  { n: TOOLS_EVALUATED, label: 'Tools reviewed' },
];

const PP_STANFORD_LIST = [
  { n: '1', h: 'Recruitment from existing patient networks',
    body: "We partner with Stanford Health Care's Patient and Family Partner Program, which coordinates patients interested in volunteering with the hospital." },
  { n: '2', h: 'Fundamentals training',
    body: 'We convene patients in person or online for a 2-hour initial training session on AI and then provide ongoing learning opportunities.' },
  { n: '3', h: 'Tool-by-tool focus groups',
    body: 'We hold a video conference based focus group with 4 patients for each AI use case and then ask participants for feedback on our draft reports.' },
  { n: '4', h: 'Compensation &amp; sustaining engagement',
    body: 'Patients are compensated for their time; we send them monthly newsletter updates.' },
];

const PP_EXTERNAL = [
  { h: 'Recruitment',
    body: 'Aim for a broad range of perspectives. Places to recruit from could include patient volunteer or engagement programs, or even direct reach out to groups of former and current patients. Recruiting 10–12 patients allows you to rotate assessments through smaller focus groups without overburdening anyone.' },
  { h: 'Training',
    body: "Onboard patients with a crash course in the basics of how AI works, how it's being used in healthcare, and common ethical issues. Send new, optional learning resources along every month or two." },
  { h: 'Facilitation',
    body: "In online focus groups of about 4 patients, use best practices for facilitation to ensure everyone is heard. Probe patients' comments to really understand what values lie behind them. Always provide a one-pager on the tool in plain language in advance." },
  { h: 'Compensation',
    body: "Compensate at a rate that signals respect for their time and input, given your institution's resources." },
  { h: 'Scaling down',
    body: 'Smaller institutions may do fine with a smaller patient panel. Just make sure diverse perspectives are still represented — for example, in terms of care experiences, professional background, and demographics.' },
  { h: 'Sustaining the program',
    body: 'Sustained engagement is what makes the panel valuable. We invite our patients to university hosted events, keep them updated on report outcomes, and send monthly newsletters. Communicating monthly about the impact patients are having helps sustain engagement over time.' },
];


/* ─────────────────────────────────────────────────────────────────────────
   ⑩ PLAYBOOK_SECTIONS · the 2-part internal operating process, rendered
   as an expand/reveal accordion (see renderToolkitPlaybook() in app.js).
   Each top-level section expands to reveal its sub-items.

   NOTE: this replaces the old PLAYBOOK_CARDS (6 external-institution
   adaptation cards). This copy is a first draft grounded in the site
   owner's own description of the internal process — review/edit before
   treating it as final, same as any other copy in this file.
─────────────────────────────────────────────────────────────────────────── */
const PLAYBOOK_SECTIONS = [
  {
    id: 'ethics-team',
    n: '01',
    h: 'Ethics Team Process',
    summary: 'How the ethics team turns stakeholder interviews and patient-partner input into a single Ethics report.',
    subitems: [
      { h: 'Conducting Stakeholder Interviews',
        body: 'The ethics team schedules and staffs each stakeholder interview, distributing a plain-language tool summary in advance.' },
      { h: 'Analyzing Findings',
        body: 'Interview transcripts are coded and reviewed, with value collisions identified for each AI use case.' },
      { h: 'Drafting the Ethics Plan',
        body: 'Findings are synthesized into written recommendations, and are subsequently shared with clinical and operational leadership.' },
    ],
  },
  {
    id: 'program-admin',
    n: '02',
    h: 'Program Administration',
    summary: 'The scheduling, documentation, and tracking work that keeps every evaluation moving on time.',
    subitems: [
      { h: 'Scheduling &amp; calendar coordination',
        body: 'Booking interview slots with stakeholders; holding recurring team meetings; and tracking the timeline for each use case from intake through delivery.' },
      { h: 'Documentation &amp; recordkeeping',
        body: 'Best practices for documenting your workflow and keeping it moving.' },
      { h: 'Cross-team coordination',
        body: 'Tips for coordinating with other teams in your AI governance process.' },
    ],
  },
];

/* ⑩b PLAYBOOK_CONSIDERATIONS · guiding questions the team weighs during
   every evaluation. Rendered as a bulleted callout, not an accordion. */
const PLAYBOOK_CONSIDERATIONS = [
  'Whose interests are represented in the room, and whose are missing?',
  'What would change our recommendation, and have we actually tested for it?',
  'What guardrails and review interval make turning on the model meaningful?',
  'Question banks, scheduling templates, and thematic-analysis scaffolds to help with interviews and data evaluation.',
];


/* ─────────────────────────────────────────────────────────────────────────
   ⑪ TEAM — removed. The team roster lives entirely in Supabase's
   team_members table now, managed from the admin dashboard
   (/admin.html) — see /supabase/team_migration.sql, which moved the
   original 7 people in as real rows before this array was deleted.
   initTeamFeature() (app.js) renders team_members directly; there is no
   longer a static fallback if Supabase is unreachable, by request.
─────────────────────────────────────────────────────────────────────────── */


/* ─────────────────────────────────────────────────────────────────────────
   ⑫ ABOUT_CARDS · two large cards on the About page
─────────────────────────────────────────────────────────────────────────── */
const ABOUT_CARDS = [
  { h: 'What we believe',
    p: 'Proactively spotting and addressing healthcare AI risks requires talking to the people who will be most affected, especially patients and clinicians. The HEAL-AI Lab at Stanford provides resources to help healthcare organizations conduct ethical assessments that are people-centered, fast, and feasible without a lot of resources.' },
];


/* ─────────────────────────────────────────────────────────────────────────
   PARTNER_LOGOS · scrolling logo marquee, About page (below the team grid)
─────────────────────────────────────────────────────────────────────────────
   All 6 source files are genuinely transparent PNG/SVG (verified — alpha=0
   at every corner), which is what makes the grayscale-by-default/color-on-
   hover treatment in renderPartnerLogos() (app.js) look clean instead of
   showing mismatched background boxes.
─────────────────────────────────────────────────────────────────────────── */
const PARTNER_LOGOS = [
  { name: 'Stanford HAI',                     file: 'assets/partners/hai.png' },
  { name: 'Stanford Health Care',             file: 'assets/partners/stanfordhc.png' },
  { name: 'Gordon and Betty Moore Foundation', file: 'assets/partners/Gordon_and_Betty_Moore_Foundation_logo.svg' },
  { name: 'PCORI',                            file: 'assets/partners/pcori.png' },
  { name: 'Lana Vento Charitable Trust',      file: 'assets/partners/lana_vento.png' },
  { name: 'Impact Labs',                      file: 'assets/partners/impactlabs.png' },
];


/* ─────────────────────────────────────────────────────────────────────────
   ⑮ NEWS · News tab — spotlight + 3 chronological feeds
─────────────────────────────────────────────────────────────────────────────
   Three independent, date-sorted arrays. renderNews() (app.js) shows the
   5 most recent from each on the News tab with a "View complete directory"
   link to a full, searchable listing page for that feed.

   `date` must be an ISO string ('YYYY-MM-DD') — everything sorts and
   formats off of it. Setting `featured: true` on a SEMINAR_VIDEOS entry
   makes it the big spotlight card at the top of the News tab; if none is
   flagged, the spotlight falls back to the single most recent video.

   PLACEHOLDER CONTENT NOTICE
     Only the Michelle Mello Grand Rounds entry below is real. Every entry
     whose title/desc starts with "PLACEHOLDER" is scaffolding to prove out
     the layout — replace with the real title, date, byline, and link
     before this ships publicly. Do not leave placeholder entries live.
─────────────────────────────────────────────────────────────────────────── */
const SEMINAR_VIDEOS = [
  { date: '2026-05-14',
    title: 'Grand Rounds: Ethical Review of Clinical AI at Scale',
    speaker: 'Michelle Mello',
    venue: 'Stanford Medicine Grand Rounds',
    desc: "Michelle Mello presents HEAL-AI's ethics review process and what two years of evaluations have surfaced about deploying AI tools responsibly across a health system.",
    link: '#', featured: true },
  { date: '2026-02-03',
    title: 'PLACEHOLDER — seminar title',
    speaker: 'PLACEHOLDER — speaker name',
    venue: 'PLACEHOLDER — venue',
    desc: 'PLACEHOLDER — replace with a real seminar description before publishing.',
    link: '#' },
  { date: '2025-11-19',
    title: 'PLACEHOLDER — seminar title',
    speaker: 'PLACEHOLDER — speaker name',
    venue: 'PLACEHOLDER — venue',
    desc: 'PLACEHOLDER — replace with a real seminar description before publishing.',
    link: '#' },
  { date: '2025-09-08',
    title: 'PLACEHOLDER — seminar title',
    speaker: 'PLACEHOLDER — speaker name',
    venue: 'PLACEHOLDER — venue',
    desc: 'PLACEHOLDER — replace with a real seminar description before publishing.',
    link: '#' },
  /* These 2 were originally in the Toolkit's "Case Studies & Talks"
     category (since removed). Exact day-of-month wasn't recorded at the
     source, only "June 2025" — the dates below are nominal placeholders
     within that month; fix if you have the real dates. */
  { date: '2025-06-12',
    title: "Stanford's Ethical Assessment Process: What and Why",
    speaker: 'Danton Char & Michelle Mello',
    venue: "CHAI Leadership Summit",
    desc: "Drs. Char and Mello's overview of HEAL-AI's ethical assessment process, presented at CHAI's Leadership Summit.",
    link: 'https://drive.google.com/file/d/1rNubDnBNKaHNSnrBgoc2l4hLzn4YZ9LX/preview' },
  { date: '2025-06-05',
    title: 'Stanford HAI Health Policy Workshop talk',
    speaker: 'Danton Char & Michelle Mello',
    venue: "Stanford HAI Health Policy Workshop",
    desc: "Presentation at the Stanford Institute for Human-Centered AI's Health Policy Workshop.",
    link: 'https://drive.google.com/file/d/1RIPwlS83wsf0T5k2dfznd4ie1ErsuvB4/preview' },
];

const NEWS_ARTICLES = [
  { date: '2026-04-22', title: 'PLACEHOLDER — article headline', source: 'PLACEHOLDER — publication name',
    desc: 'PLACEHOLDER — replace with a real summary before publishing.', link: '#' },
  { date: '2026-01-15', title: 'PLACEHOLDER — article headline', source: 'PLACEHOLDER — publication name',
    desc: 'PLACEHOLDER — replace with a real summary before publishing.', link: '#' },
  { date: '2025-10-30', title: 'PLACEHOLDER — article headline', source: 'PLACEHOLDER — publication name',
    desc: 'PLACEHOLDER — replace with a real summary before publishing.', link: '#' },
  { date: '2025-08-11', title: 'PLACEHOLDER — article headline', source: 'PLACEHOLDER — publication name',
    desc: 'PLACEHOLDER — replace with a real summary before publishing.', link: '#' },
  { date: '2025-05-27', title: 'PLACEHOLDER — article headline', source: 'PLACEHOLDER — publication name',
    desc: 'PLACEHOLDER — replace with a real summary before publishing.', link: '#' },
  { date: '2025-02-14', title: 'PLACEHOLDER — article headline', source: 'PLACEHOLDER — publication name',
    desc: 'PLACEHOLDER — replace with a real summary before publishing.', link: '#' },
];

const SCHOLARLY_PUBLICATIONS = [
  { date: '2026-03-09', title: 'PLACEHOLDER — paper title', authors: 'PLACEHOLDER — author list', journal: 'PLACEHOLDER — journal / venue',
    desc: 'PLACEHOLDER — replace with a real abstract snippet before publishing.', link: '#' },
  { date: '2025-12-18', title: 'PLACEHOLDER — paper title', authors: 'PLACEHOLDER — author list', journal: 'PLACEHOLDER — journal / venue',
    desc: 'PLACEHOLDER — replace with a real abstract snippet before publishing.', link: '#' },
  { date: '2025-09-25', title: 'PLACEHOLDER — paper title', authors: 'PLACEHOLDER — author list', journal: 'PLACEHOLDER — journal / venue',
    desc: 'PLACEHOLDER — replace with a real abstract snippet before publishing.', link: '#' },
  { date: '2025-07-02', title: 'PLACEHOLDER — paper title', authors: 'PLACEHOLDER — author list', journal: 'PLACEHOLDER — journal / venue',
    desc: 'PLACEHOLDER — replace with a real abstract snippet before publishing.', link: '#' },
  { date: '2025-04-16', title: 'PLACEHOLDER — paper title', authors: 'PLACEHOLDER — author list', journal: 'PLACEHOLDER — journal / venue',
    desc: 'PLACEHOLDER — replace with a real abstract snippet before publishing.', link: '#' },
  { date: '2025-01-08', title: 'PLACEHOLDER — paper title', authors: 'PLACEHOLDER — author list', journal: 'PLACEHOLDER — journal / venue',
    desc: 'PLACEHOLDER — replace with a real abstract snippet before publishing.', link: '#' },
];


/* ─────────────────────────────────────────────────────────────────────────
   ⑭ ICONS · inline SVG icon library
─────────────────────────────────────────────────────────────────────────────
   Each value is the INNER markup of a 24×24 SVG (paths, circles, etc.).
   app.js wraps the value in <svg viewBox="0 0 24 24">…</svg> when rendering.

   ARCHITECTURAL NOTE
     We use inline SVG instead of an icon font because:
       (a) icons inherit currentColor (works with our cardinal/grey themes),
       (b) no extra network request and no FOIT, and
       (c) screen-reader-friendly when wrapped with aria-hidden.

   To add a new icon:
     1. Add a new key here with the paths between <svg>…</svg>.
     2. Reference it by name (e.g. icon: 'mychip') anywhere in this file.
─────────────────────────────────────────────────────────────────────────── */
const ICONS = {
  video:    '<path d="M3 6.5A2.5 2.5 0 0 1 5.5 4h9A2.5 2.5 0 0 1 17 6.5v11A2.5 2.5 0 0 1 14.5 20h-9A2.5 2.5 0 0 1 3 17.5z"/><path d="M17 9l4-3v12l-4-3"/>',
  route:    '<path d="M5 3v14a4 4 0 0 0 4 4h6a4 4 0 0 0 4-4V7"/><circle cx="5" cy="3" r="2"/><circle cx="19" cy="7" r="2"/>',
  download: '<path d="M12 3v12m0 0l-5-5m5 5l5-5"/><path d="M5 21h14"/>',
  book:     '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 4v13"/>',
  mail:     '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 7 9-7"/>',
  deck:     '<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 21h8M12 18v3"/>',
  paper:    '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/>',
  link:     '<path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1"/><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"/>',
  mic:      '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  sheet:    '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16"/>',
  cal:      '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  building: '<path d="M4 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16"/><path d="M15 9h3a2 2 0 0 1 2 2v10"/><path d="M8 8h3M8 12h3M8 16h3"/>',
  people:   '<circle cx="9" cy="9" r="3"/><circle cx="17" cy="10" r="2.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M14 20c0-2.6 1.7-4.8 4-5.6"/>',
  chip:     '<rect x="5" y="5" width="14" height="14" rx="2"/><path d="M9 9h6v6H9z"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/>',
  coin:     '<circle cx="12" cy="12" r="9"/><path d="M9 9h4a2 2 0 1 1 0 4h-4M9 15h5"/>',
  clock:    '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
  briefcase:'<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 12h18"/>',
  arrowOut: '<path d="M7 17L17 7M9 7h8v8"/>',
  arrowR:   '<path d="M7 5l7 7-7 7"/>',
  play:     '<path d="M8 5v14l11-7z"/>',
  chev:     '<path d="M6 9l6 6 6-6"/>',
};
