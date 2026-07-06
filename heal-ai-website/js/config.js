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
   ② SIGN-UP URL
─────────────────────────────────────────────────────────────────────────────
   The Google Form (or future Mailchimp / HubSpot) URL used by every
   "Sign up for updates" CTA across the site. The following elements get
   their href set to this value at runtime in app.js → renderNav():

     • Top-nav button         (#nav-signup-btn)
     • Mobile menu button     (added in renderNav)
     • Home page Sign-up card (#home-signup-btn)
     • Playbook page notify   (#playbook-signup-btn)
     • Footer link            (#footer-signup)
     • Phase-1 Videos notice  (CTA inside the "Coming soon" card)

   EDIT HERE  →  replace with the live Google Form URL once provisioned.
─────────────────────────────────────────────────────────────────────────── */
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
const PAGE_IDS = ['home', 'process', 'videos', 'resources', 'patient', 'playbook', 'about'];

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
  /* total time the loader splash is on screen — the liquid-fill CSS
     animation itself runs 1.6s, so this leaves a ~600ms beat with the
     logo fully filled before the exit fade starts. */
  loaderHoldMs: 2200,
};
