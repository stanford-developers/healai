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
   ⑥ FURM_STEPS ............. 4-step process methodology
   ⑦ VIDEOS ................. 6-part training series (Phase 2)
   ⑧ RESOURCE_CATEGORIES .... tabbed library, includes the 8 sample reports
   ⑨ PP_STATS / PP_STANFORD / PP_EXTERNAL  ... patient partner panel content
   ⑩ PLAYBOOK_CARDS ......... 6 institutional-adaptation cards
   ⑪ TEAM ................... about-page team grid
   ⑫ ABOUT_CARDS ............ "How we got here" / "What we believe"
   ⑬ PAPERS ................. hover content for the hero canvas research nodes
   ⑭ ICONS .................. inline-SVG icon library

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
  { id: 'home',      label: 'Home' },
  { id: 'process',   label: 'Process' },
  { id: 'videos',    label: 'Videos',    videoOnly: true },
  { id: 'resources', label: 'Resources' },
  { id: 'patient',   label: 'Patient Panel' },
  { id: 'playbook',  label: 'Playbook' },
  { id: 'about',     label: 'About' },
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
  eyebrow: 'A toolkit for ethical clinical AI evaluation',
  headline: 'If your health system is implementing AI tools — <em>here is how to assess them ethically.</em>',
  sub: 'HEAL-AI is a Stanford toolkit for external health systems who want a structured, patient-inclusive way to evaluate clinical AI: videos, templates, sample reports, and a playbook for adapting our process to your institution.',
  buttons: [
    { label: 'See the process →', action: 'page:process',   variant: 'prime' },
    { label: 'Browse resources',  action: 'page:resources', variant: 'second' },
  ],
};


/* ─────────────────────────────────────────────────────────────────────────
   ③ HOME_ABOUT · positioning statement + 3 pillars
─────────────────────────────────────────────────────────────────────────────
   `statement` supports HTML for the cardinal-italic emphasis treatment.
   `bullets` accepts any number of pillar cards — the layout flexes.
─────────────────────────────────────────────────────────────────────────── */
const HOME_ABOUT = {
  statement: "If your health system is implementing AI tools and you want a <em>structured way to assess them ethically</em>, you're in the right place. We've spent three years building, testing, and publishing an evaluation process at Stanford — now we share it openly so you can adapt it for your institution.",
  bullets: [
    { letter: 'F', title: 'Fair, Useful, Reliable',
      body: "Grounded in Stanford's FURM framework — peer-reviewed, evidence-based." },
    { letter: 'P', title: 'Patient-included',
      body: 'Structured patient-partner input is foundational, not a checkbox.' },
    { letter: 'A', title: 'Adaptable',
      body: 'Templates &amp; playbook designed for cross-institutional use.' },
  ],
};


/* ─────────────────────────────────────────────────────────────────────────
   ④ STATS · the 3-stat band beneath the hero
─────────────────────────────────────────────────────────────────────────── */
const STATS = [
  { n: '12+',  label: 'AI tools evaluated across <strong>Stanford Health Care</strong>' },
  { n: '100%', label: 'of evaluations include <strong>structured patient input</strong>' },
  { n: '8',    label: '<strong>redacted sample reports</strong> in the resource library' },
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
    desc: 'A six-part training series introduces FURM, the four-step process, and patient panel facilitation.',
    action: 'page:videos' },
  { n: '02', icon: 'route',    title: 'Learn the process',
    desc: 'Walk through Intake → Stakeholder Interviewing → Expert Vetting → Delivery with worked examples.',
    action: 'page:process' },
  { n: '03', icon: 'download', title: 'Download resources',
    desc: 'Templates, interview guides, focus-group materials, and eight redacted sample reports.',
    action: 'page:resources' },
  { n: '04', icon: 'book',     title: 'Adapt the playbook',
    desc: 'Use the DiME Playbook to right-size the process for your institution.',
    action: 'page:playbook' },
  { n: '05', icon: 'mail',     title: 'Sign up for updates',
    desc: "Subscribe so you know when new videos, templates, and reports go live.",
    action: 'url' },
];


/* ─────────────────────────────────────────────────────────────────────────
   ⑥ FURM_STEPS · the 4-step evaluation methodology
─────────────────────────────────────────────────────────────────────────────
   `gates` is a small visual indicator (filled dots) showing cumulative
   progress. Keep its length aligned with the step number.
─────────────────────────────────────────────────────────────────────────── */
const FURM_STEPS = [
  { n: '01', title: 'Intake',
    desc: 'A clinical or operational sponsor submits the AI tool for review. We capture intended use, stakeholders, vendor data, and the deployment timeline.',
    gates: 1 },
  { n: '02', title: 'Stakeholder Interviewing',
    desc: 'Structured interviews with developers, clinical users, operational owners, and patient partners. Themes feed every downstream decision.',
    gates: 2 },
  { n: '03', title: 'Expert Vetting',
    desc: 'Clinical informaticists, ethicists, equity researchers, and patient partners review the tool against FURM. Disagreement is surfaced, not papered over.',
    gates: 3 },
  { n: '04', title: 'Delivery',
    desc: 'A written Ethics &amp; Operations Plan (EOP) is shared with leadership: pass, fail, or conditional approval with explicit guardrails and review intervals.',
    gates: 4 },
];


/* ─────────────────────────────────────────────────────────────────────────
   ⑦ VIDEOS · the 6-part training series
─────────────────────────────────────────────────────────────────────────────
   • `embed` is the iframe URL. For YouTube, use the /embed/{id} form.
     For Vimeo, use https://player.vimeo.com/video/{id}.
   • `resources` is a list of short chip labels that link the user back to
     the Resources page (chip handler in app.js → goPage('resources')).
   • These don't render at all when SHOW_VIDEOS is false (Phase 1).

   EDIT HERE  →  drop in the real embed URLs once the videos are uploaded.
─────────────────────────────────────────────────────────────────────────── */
const VIDEOS = [
  { id: 'v1', num: '01', title: 'Welcome to HEAL-AI', duration: '8:42',
    desc: 'Why centralized, ethics-grounded AI evaluation matters — and what this toolkit covers.',
    embed: 'https://www.youtube.com/embed/REPLACE_ID',
    resources: ['Overview deck', 'Glossary', 'Intake template'] },

  { id: 'v2', num: '02', title: 'The FURM Framework', duration: '14:21',
    desc: 'A deep-dive on Fair, Useful, Reliable Models — the analytic spine of every evaluation.',
    embed: 'https://www.youtube.com/embed/REPLACE_ID',
    resources: ['FURM whitepaper', 'DiME alignment notes'] },

  { id: 'v3', num: '03', title: 'Running Stakeholder Interviews', duration: '19:08',
    desc: 'Field-tested guides for interviewing developers, clinical users, and operational owners.',
    embed: 'https://www.youtube.com/embed/REPLACE_ID',
    resources: ['Developer guide', 'User guide', 'Thematic analysis template'] },

  { id: 'v4', num: '04', title: 'The Patient Partner Panel', duration: '17:55',
    desc: 'Recruiting, training, and running a patient panel — and what it changes in practice.',
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

   EDIT HERE  →  add new items to any items[] or rewrite intro copy.
   The 8 SAMPLE REPORTS are the spec-required deliverables — keep all 8.
─────────────────────────────────────────────────────────────────────────── */
const RESOURCE_CATEGORIES = [
  /* ─ Tab 1 ─ Understanding the Process ─────────────────────────────── */
  {
    id: 'understand',
    label: 'Understanding the Process',
    intro: {
      h: 'Start here.',
      p: 'A complete orientation: what FURM is, why it exists, what the four steps deliver, and how DiME aligns with our published methodology.',
      bullets: ['Read the overview deck', 'Watch Videos 01–02', 'Skim the FURM whitepaper'],
    },
    items: [
      { h: 'Overview deck',         icon: 'deck',  state: 'ready', href: '#',
        sub: 'High-level introduction to HEAL-AI and the FURM framework.' },
      { h: 'FURM whitepaper',       icon: 'paper', state: 'ready', href: '#',
        sub: 'The peer-reviewed methodology paper. PDF, 18 pages.' },
      { h: 'DiME alignment notes',  icon: 'link',  state: 'ready', href: '#',
        sub: 'How HEAL-AI maps to Digital Medicine Society standards.' },
      { h: 'Glossary',              icon: 'book',  state: 'ready', href: '#',
        sub: 'Plain-language definitions for FURM, EOP, intake, and more.' },
    ],
  },

  /* ─ Tab 2 ─ Running Stakeholder Interviews ────────────────────────── */
  {
    id: 'interviews',
    label: 'Running Stakeholder Interviews',
    intro: {
      h: 'Get usable signal from developers, users, and owners.',
      p: 'Question banks, scheduling templates, and thematic-analysis scaffolds that turn one-hour interviews into evaluation evidence.',
      bullets: ['Pull the interview guides', 'Use the thematic template', 'Pair with Video 03'],
    },
    items: [
      { h: 'Developer interview guide',    icon: 'mic',   state: 'soon',
        sub: 'For the team that built or vended the AI tool.' },
      { h: 'Clinical user interview guide',icon: 'mic',   state: 'soon',
        sub: 'For clinicians actively using the tool at the point of care.' },
      { h: 'Thematic analysis template',   icon: 'sheet', state: 'ready', href: '#',
        sub: 'Spreadsheet for coding interview transcripts.' },
      { h: 'Scheduling &amp; logistics',   icon: 'cal',   state: 'ready', href: '#',
        sub: 'Outreach scripts, calendar templates, recording norms.' },
    ],
  },

  /* ─ Tab 3 ─ Running a Patient Partner Group ───────────────────────── */
  {
    id: 'panel',
    label: 'Running a Patient Partner Group',
    intro: {
      h: 'Bring patient voice into the room.',
      p: 'How we recruit, train, and run our 10-volunteer panel — and the facilitation artifacts you need to do the same.',
      bullets: ["Read Stanford's model", "Use the moderator's guide", 'Pair with Video 04'],
    },
    items: [
      { h: "Moderator's guide",                icon: 'mic',   state: 'soon',
        sub: '90-minute focus group structure with prompt library.' },
      { h: 'Recruitment script',               icon: 'mail',  state: 'ready', href: '#',
        sub: 'Outreach language used with the Stanford patient council.' },
      { h: 'Fundamentals training curriculum', icon: 'book',  state: 'ready', href: '#',
        sub: '8-hour onboarding for new patient partners.' },
      { h: 'Compensation &amp; consent template', icon: 'paper', state: 'ready', href: '#',
        sub: 'Compensation rates, consent language, IRB notes.' },
    ],
  },

  /* ─ Tab 4 ─ Writing & Delivering Your Report ───────────────────────
       This tab uniquely includes a `reports` array which renders the
       8 redacted sample reports beneath the resource cards.
     ─────────────────────────────────────────────────────────────────── */
  {
    id: 'reports',
    label: 'Writing &amp; Delivering Your Report',
    intro: {
      h: 'The Ethics &amp; Operations Plan, end-to-end.',
      p: 'A blank EOP template plus eight redacted sample reports from real evaluations at Stanford Health Care.',
      bullets: ['Use the EOP template', 'Reference the sample reports', 'Pair with Video 05'],
    },
    items: [
      { h: 'EOP template',          icon: 'paper', state: 'ready', href: '#',
        sub: 'Blank Ethics &amp; Operations Plan, in Word and Markdown.' },
      { h: 'Cover-letter template', icon: 'mail',  state: 'ready', href: '#',
        sub: 'For sharing the EOP with clinical and operational leadership.' },
    ],
    /* The 8 SAMPLE REPORTS — required by spec. `href` lets you point each at
       a real PDF / Drive link once redacted artifacts are uploaded. */
    reports: [
      { code: '01', name: 'HeartRead',           sub: 'Cardiology imaging triage',         href: '#' },
      { code: '02', name: 'NoteBuddy',           sub: 'Ambient clinical scribing',         href: '#' },
      { code: '03', name: 'AuthorizeMe',         sub: 'Prior-authorization assistant',     href: '#' },
      { code: '04', name: 'RadiRead',            sub: 'Radiology report draft',            href: '#' },
      { code: '05', name: 'Copilot',             sub: 'Clinical documentation copilot',    href: '#' },
      { code: '06', name: 'Payment Probability', sub: 'Revenue cycle prediction',          href: '#' },
      { code: '07', name: 'LabAlert',            sub: 'Critical-value flagging',           href: '#' },
      { code: '08', name: 'SendOff',             sub: 'Discharge summary generation',      href: '#' },
    ],
  },

  /* ─ Tab 5 ─ Adapting for Your Institution ──────────────────────────── */
  {
    id: 'adapt',
    label: 'Adapting for Your Institution',
    intro: {
      h: 'Make this process yours.',
      p: 'Institution-level resources for governance structure, IT integration, staffing models, and the forthcoming DiME Playbook.',
      bullets: ['Skim the adaptation worksheet', 'Watch Video 06', 'Wait-list the DiME Playbook'],
    },
    items: [
      { h: 'Adaptation worksheet',         icon: 'sheet', state: 'ready', href: '#',
        sub: 'A self-assessment to right-size the process for your institution.' },
      { h: 'DiME Playbook',                icon: 'book',  state: 'soon',
        sub: 'Forthcoming joint publication with the Digital Medicine Society.' },
      { h: 'Cross-institutional briefing deck', icon: 'deck', state: 'ready', href: '#',
        sub: 'For securing executive sponsorship at your health system.' },
      { h: 'IRB &amp; legal review notes', icon: 'paper', state: 'ready', href: '#',
        sub: 'How Stanford routed this through governance — translatable to other institutions.' },
    ],
  },
];


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
  { n: '10', label: 'Volunteer partners' },
  { n: '12', label: 'Tools reviewed' },
  { n: '3y', label: 'In operation' },
];

const PP_STANFORD_LIST = [
  { n: '1', h: 'Recruitment from existing patient networks',
    body: "We partner with Stanford Health Care's patient advisory council and community health programs." },
  { n: '2', h: 'Fundamentals training',
    body: 'Eight-hour curriculum covering clinical AI basics, FURM, ethics review, and facilitation norms.' },
  { n: '3', h: 'Tool-by-tool focus groups',
    body: 'Moderated 90-minute sessions per tool, with structured guides and follow-up written input.' },
  { n: '4', h: 'Compensation &amp; sustaining engagement',
    body: 'Patients are compensated for their time; we hold quarterly community-of-practice meetings.' },
];

const PP_EXTERNAL = [
  { h: 'Recruitment',
    body: 'Start with the patient advisory groups you already have. Compensated, time-bounded engagement is easier to staff than open-ended advisory roles. Aim for racial, linguistic, and clinical diversity from day one — not after the first cohort.' },
  { h: 'Training',
    body: 'An 8-hour fundamentals curriculum is the sweet spot. Cover: how AI is used in care, FURM basics, ethics-review vocabulary, and facilitation norms (turn-taking, dissent, paraphrasing). Open-source slides ship with the Playbook.' },
  { h: 'Facilitation',
    body: '90-minute focus groups, one tool at a time, with a trained moderator and a scribe. Always provide a one-pager on the tool in plain language 5 days in advance. Always close with written follow-up so quiet voices reach the record.' },
  { h: 'Compensation',
    body: 'Compensate at a rate that signals respect — not the institutional minimum. Stanford pays per-meeting and per-deliverable. Build the compensation line into your evaluation program budget from the start; do not run it through volunteer overhead.' },
  { h: 'Scaling down',
    body: "Smaller institutions can run a 4-person panel and a single annual cohort. The trade-off is throughput, not legitimacy — small panels work as long as recruitment is genuinely diverse and the facilitator is trained. Don't dilute the standard." },
  { h: 'Sustaining the program',
    body: 'Hold quarterly community-of-practice meetings even when no tools are under review. Sustained engagement is what makes the third year of a panel valuable — partners build vocabulary, trust, and institutional memory you cannot buy.' },
];


/* ─────────────────────────────────────────────────────────────────────────
   ⑩ PLAYBOOK_CARDS · the 6 institutional-adaptation cards
─────────────────────────────────────────────────────────────────────────── */
const PLAYBOOK_CARDS = [
  { h: 'Governance structure',
    desc: 'Where does AI ethics review live — clinical informatics, compliance, a standalone office? Trade-offs are real.',
    icon: 'building', state: 'ready' },
  { h: 'Staffing &amp; roles',
    desc: 'A minimum-viable program is 1.5 FTEs. We outline what each role does and how to phase hiring.',
    icon: 'people', state: 'ready' },
  { h: 'IT &amp; data integration',
    desc: 'How to obtain vendor data, model-card artifacts, and post-deployment monitoring telemetry.',
    icon: 'chip', state: 'soon' },
  { h: 'Patient panel scale',
    desc: '4-person vs. 10-person panels: throughput trade-offs and recruitment recommendations.',
    icon: 'people', state: 'ready' },
  { h: 'Compensation &amp; budget',
    desc: 'Stanford-tested compensation rates and a sample one-year program budget you can adapt.',
    icon: 'coin', state: 'ready' },
  { h: 'Leadership buy-in',
    desc: 'Templates for the executive briefing, the board update, and the first-year operating plan.',
    icon: 'deck', state: 'ready' },
];


/* ─────────────────────────────────────────────────────────────────────────
   ⑪ TEAM · About-page team grid
─────────────────────────────────────────────────────────────────────────────
   Real Stanford HEAL-AI current staff. Roles pulled from the live People
   page. Photos live in /assets/current_staff/ — file names preserved
   verbatim from the source so it's obvious which asset is which person.

   EDIT-HERE MAP
     • Add / remove a person   → add / remove an object here.
     • Update a role or badge  → edit the strings inline.
     • Swap a photo            → drop the new file into /assets/current_staff/
                                  and update the `photo` path below.

   FIELD REFERENCE
     name    Displayed under the avatar.
     role    Sub-line under the name (their Stanford title).
     badge   Small pill at the bottom of the card (Director / Faculty /
             Postdoc / Staff — used for quick grouping at a glance).
     photo   Path (relative to index.html) to the profile picture.
             Leave `photo` empty and set `init` instead to fall back to
             the cardinal-with-initials avatar (see renderTeam in app.js).
─────────────────────────────────────────────────────────────────────────── */
const TEAM = [
  {
    name:    'Michelle Mello',
    role:    'Professor of Law and of Health Policy',
    badge:   'Director',
    photo:   'assets/current_staff/michelle-mello1673734692135.png.webp',
    profile: 'https://law.stanford.edu/michelle-m-mello/',
  },
  {
    name:    'Danton Samuel Char',
    role:    'Principal Investigator',
    badge:   'Director',
    photo:   'assets/current_staff/danton_samuel_char.png.webp',
    profile: 'https://profiles.stanford.edu/danton-char',
  },
  {
    name:  'N. Lance Downing',
    role:  'Clinical Assistant Professor',
    badge: 'Faculty',
    photo: 'assets/current_staff/norman-downing1509518804318.png.webp',
  },
  {
    name:    'Artem A. Trotsyuk, Ph.D.',
    badge:    'Member of Technical Staff',
    role:   'Postdoctoral Scholar',
    photo:   'assets/current_staff/artem-trotsyuk1694722251843.png.webp',
    profile: 'https://profiles.stanford.edu/artem-trotsyuk',
  },
  {
    name:  'Elisabeth Grosvenor',
    role:  'Life Science Research Professional 1',
    badge: 'Research',
    photo: 'assets/current_staff/elisabeth-grosvenor1667954347746.png.webp',
  },
  {
    name:    'Alison Callahan',
    badge:   'Member of Technical Staff',
    role:    'Research Engineer',
    photo:   'assets/current_staff/alison-callahan1770857252230.png.webp',
    profile: 'https://med.stanford.edu/profiles/alison-callahan',
  },
];


/* ─────────────────────────────────────────────────────────────────────────
   ⑫ ABOUT_CARDS · two large cards on the About page
─────────────────────────────────────────────────────────────────────────── */
const ABOUT_CARDS = [
  { h: 'How we got here',
    p: 'HEAL-AI was founded in 2022 after a Stanford internal audit revealed that several AI tools had been deployed across clinical divisions under inconsistent approval processes — none with formal patient input. We were built to close that gap.' },
  { h: 'What we believe',
    p: 'Ethics review cannot be left to individual departments. A centralized, transparent, patient-inclusive process is not optional — it is the only way clinical AI earns genuine trust. HEAL-AI provides that process, and now shares it openly.' },
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
  arrowOut: '<path d="M7 17L17 7M9 7h8v8"/>',
  arrowR:   '<path d="M7 5l7 7-7 7"/>',
  play:     '<path d="M8 5v14l11-7z"/>',
  chev:     '<path d="M6 9l6 6 6-6"/>',
};
