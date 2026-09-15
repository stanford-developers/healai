/*
═════════════════════════════════════════════════════════════════════════════
 HEAL-AI · js/config.js
─────────────────────────────────────────────────────────────────────────────
 PURPOSE
   Single source of truth for site-wide TOGGLES and global URLs.
   Nothing in here is page copy — all text content lives in /js/data.js.

 WHEN TO EDIT THIS FILE
   • Flipping the site between Phase 1 (no videos) and Phase 2 (videos live).
   • Updating the Google Form sign-up URL.
   • Re-branding the loader / logo wordmark.
   • Toggling animations on the site as a whole.

 EVERYTHING IN THIS FILE IS A GLOBAL.
   These constants are read by data.js and app.js via window scope. We use
   `const` declarations (without `export`) on purpose — this site is
   intentionally framework-free and module-bundler-free so non-engineers on
   the HEAL-AI team can hand-edit any file and refresh the browser.
═════════════════════════════════════════════════════════════════════════════
*/


/* ─────────────────────────────────────────────────────────────────────────
   ① PHASE FLAG · SHOW_VIDEOS
─────────────────────────────────────────────────────────────────────────────
   The single most important toggle in this codebase.

   WHAT IT CONTROLS
     • Whether the "Videos" tab appears in the top + mobile nav.
     • What renders on the /videos page:
         false → a clean "Coming soon" notice with a Sign-up CTA
         true  → the 6-video grid with a working accessible iframe modal

   PHASE 1 — PRE-VIDEO LAUNCH (current state, set to false)
     The site ships with reorganized content, FURM messaging, the playbook
     teaser, and the patient panel split. Resource items that depend on the
     videos (e.g., "Pair with Video 03") still appear as guidance, but no
     iframe player is wired up.

   PHASE 2 — VIDEO LAUNCH (set to true)
     Flip this to `true`, then update the `embed` URLs in /js/data.js
     (see the VIDEOS array). Nothing else needs to change.

   EDIT HERE  →  change `false` to `true` when videos are ready to ship.
─────────────────────────────────────────────────────────────────────────── */
const SHOW_VIDEOS = false;


/* ─────────────────────────────────────────────────────────────────────────
   ①b PHASE FLAG · SHOW_NEWS
─────────────────────────────────────────────────────────────────────────────
   Same idea as SHOW_VIDEOS, for the News tab and its three directory
   pages (seminar videos / news articles / scholarly publications).

   WHAT IT CONTROLS
     • Whether "News" appears in the top nav, the mobile menu, and both
       footers.
     • Whether the News pages are routable at all: with this false,
       #news (and #news-videos / #news-articles / #news-publications)
       redirect to the home page instead of rendering, so an old link or
       a typed hash can't surface a hidden section.
     • Whether news items are indexed by site search.
     • Whether the feeds are fetched from Supabase at all — skipping that
       request also avoids a pointless round trip.

   TURNED OFF 2026-09-15 at the team's request: the seminar feed has three
   real talks but the articles and publications feeds are empty, and a
   section with two empty feeds looked unfinished ahead of a presentation.
   NOTHING has been deleted — flip this back to `true` and the whole tab
   returns exactly as it was.

   EDIT HERE  →  change `false` to `true` when there's enough content.
─────────────────────────────────────────────────────────────────────────── */
const SHOW_NEWS = false;


/* ─────────────────────────────────────────────────────────────────────────
   ② SIGN-UP · endpoint + fallback URL
─────────────────────────────────────────────────────────────────────────────
   SIGNUP_ENDPOINT is the Google Apps Script Web App URL that appends one
   row (name / email / affiliation) to the signups Google Sheet. Setup
   instructions, and the script to paste, are in
   /google-apps-script/signup-sheet.gs.

   WHEN SET  → the site collects sign-ups in its own form: inline in the
               home page's sign-up card, and in a modal from every other
               "Sign up" CTA. Nothing leaves the site.
   WHEN NOT  → every CTA falls back to opening SIGN_UP_URL in a new tab,
               which is how the site behaved before the form existed.

   The URL looks like https://script.google.com/macros/s/AKfycb…/exec —
   it is a write-only endpoint, not a secret, and gives no access to the
   Sheet's contents, so it is fine to have in a public repo.

   EDIT HERE  →  paste your deployed Web app URL over the placeholder.
─────────────────────────────────────────────────────────────────────────── */
const SIGNUP_ENDPOINT = 'https://script.google.com/macros/s/AKfycbyAk0JCEFbms9t3YCdkJmNhpHzXB0q-HXkgkHWqIIraWbSCinZJVKUS20w8PnnfYVVW/exec';

/* Fallback only — used by every "Sign up for updates" CTA when
   SIGNUP_ENDPOINT is still the placeholder above. See openSignUp() in
   app.js for the elements involved. */
const SIGN_UP_URL = 'https://docs.google.com/forms/d/e/REPLACE-WITH-FORM-ID/viewform';


/* ─────────────────────────────────────────────────────────────────────────
   ④ ROUTING — page identifiers
─────────────────────────────────────────────────────────────────────────────
   These IDs must match the `id` attribute on each <section class="page">
   in index.html (each is prefixed with "page-" in the DOM).

   To ADD a new page:
     1. Add a new <section class="page" id="page-XXX"> in index.html.
     2. Add a NAV_ITEM in data.js with {id:'XXX', label:'XXX'}.
     3. Append 'XXX' to PAGE_IDS here.
─────────────────────────────────────────────────────────────────────────── */
const PAGE_IDS = [
  'home', 'toolkit', 'videos', 'patient', 'about',
  'news', 'news-videos', 'news-articles', 'news-publications',
];

/* The page rendered on first load. */
const DEFAULT_PAGE = 'home';


/* ─────────────────────────────────────────────────────────────────────────
   ⑤ FEATURE TOGGLES (optional, future-proofing)
─────────────────────────────────────────────────────────────────────────────
   These are minor on/off switches the team may want to flip at deploy time
   without diving into app.js. Add new ones here following the same pattern.
─────────────────────────────────────────────────────────────────────────── */
const FEATURES = {
  /* Show the loader splash on first load. Set false to skip straight to the page
     (useful for testing or when embedding inside another site). */
  showLoader: true,

  /* Animate the hero canvas mesh. Honors prefers-reduced-motion automatically
     in app.js regardless of this setting. Set false to fully disable the
     animation loop on low-power devices. */
  heroAnimation: true,

  /* Auto-rotate the resource tabs every N seconds. Off by default to respect
     a11y; flip true only if marketing explicitly asks. */
  autoCycleResources: false,
};


/* ─────────────────────────────────────────────────────────────────────────
   ⑥ TIMINGS (in milliseconds)
─────────────────────────────────────────────────────────────────────────────
   Centralized so all timing-based behavior stays in sync visually. Edit
   here, not inside app.js, to keep the brand feel coherent.
─────────────────────────────────────────────────────────────────────────── */
const TIMINGS = {
  /* total time the loader splash is on screen, the liquid-fill CSS
     animation itself runs 1.6s, so this leaves a ~600ms beat with the
     logo fully filled before the exit fade starts. */
  loaderHoldMs: 2200,
};


/* ─────────────────────────────────────────────────────────────────────────
   ⑦ SUPABASE — backend for admin-uploaded Toolkit resources
─────────────────────────────────────────────────────────────────────────────
   Read by both index.html (anonymous, read-only: shows uploaded resources
   in the public Toolkit tab) and admin.html (authenticated: lets an admin
   sign in and upload/edit/delete resources). Both pages load the Supabase
   client from a CDN, then call `createClient(SUPABASE_URL, SUPABASE_ANON_KEY)`.

   The anon key is safe to publish here, it identifies the project, not a
   privileged user. Every read/write is enforced server-side by Postgres
   Row Level Security policies (see /supabase/schema.sql), not by this key
   being secret. NEVER put the "service_role" key in this file or anywhere
   else in this repo, that key bypasses RLS entirely.

   ONE-TIME SETUP (see /supabase/schema.sql for the full checklist):
     1. Create a free project at supabase.com.
     2. Project Settings → API → copy "Project URL" and the "anon" public
        key, paste them in below.
     3. Run /supabase/schema.sql in the Supabase SQL Editor.
     4. Create a public Storage bucket named "resource-files".
     5. Have the first admin sign up once at /admin, then in the
        Supabase Table Editor flip that person's `profiles.is_admin` to
        true by hand. Repeat for any future admin, there's no self-service
        promotion by design.

   EDIT HERE  →  paste your real Project URL and anon key once created.
─────────────────────────────────────────────────────────────────────────── */
const SUPABASE_URL = 'https://plqcpxurgusluqapksru.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBscWNweHVyZ3VzbHVxYXBrc3J1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4NTIxMjgsImV4cCI6MjEwMTQyODEyOH0.To9LyU9vl0kAxzWpJSvLkn63TWF5HsQd7WJHLEg13MY';
