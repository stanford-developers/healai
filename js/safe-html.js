/*
═════════════════════════════════════════════════════════════════════════════
 HEAL-AI · js/safe-html.js
─────────────────────────────────────────────────────────────────────────────
 PURPOSE
   The two helpers every page uses before it puts database text into
   innerHTML. Loaded by index.html (before app.js) and admin.html (before
   admin.js), so both pages share one copy of the rules.

 WHY THIS FILE EXISTS
   Editors type titles, descriptions, transcripts and links into the admin
   dashboard, and the public site used to drop those strings straight into
   innerHTML. A title like  <img src=x onerror=…>  then ran as code for every
   visitor, and a link like  javascript:…  ran when clicked. That code runs
   as this website, so it could read an editor's login session or whatever
   the assistant panel is showing. (Finding W1 of the 2026-11-17 review.)

 THE RULE
   • Text that came from the database goes through escapeHTML() once, where
     the row is turned into the shape the page renders. After that it is
     plain text that happens to be safe inside HTML.
   • Any URL, from any source, goes through safeURL() at the place it is
     written into an attribute (href, src, data-href).
   • js/data.js is different on purpose: its strings are written as HTML by
     the team (<em>, <strong>, &amp; …), reviewed in git like the code
     itself. Escaping them would print "&amp;" on the page. They are not
     passed through escapeHTML().

 Plain ES2017, no dependencies. tools/test-site.mjs loads this file on its
 own to test it.
═════════════════════════════════════════════════════════════════════════════
*/

/**
 * Makes any value safe to place inside HTML text or a quoted attribute.
 * The five characters below are the only ones that can end a text run or
 * an attribute value, so replacing them is enough. null/undefined become
 * '' rather than the words "null"/"undefined" on the page.
 */
function escapeHTML(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* Link types a visitor can safely be sent to. Everything else is refused:
   javascript:, data:, vbscript:, file:, blob: and any scheme we have not
   thought of. An allowlist rather than a blocklist, because a blocklist
   fails open the day someone finds a scheme nobody listed. */
const SAFE_URL_SCHEMES = ['http:', 'https:', 'mailto:'];

/**
 * Checks a URL and returns it ready to put inside a quoted attribute, or
 * '' when it is not a link type we allow.
 *
 * Accepted: http(s) and mailto links, and links inside this site — a
 * #hash (#toolkit, #reports?open=…) or a relative path (assets/…, /admin).
 *
 * The browser's own URL parser decides what the scheme is, not a regex.
 * That matters because browsers ignore tabs, newlines and leading spaces
 * in a URL, and ignore letter case in the scheme, so "Java\tScript:" is
 * still javascript: to them. new URL() applies those same rules, so it
 * sees the same scheme the browser would.
 *
 * Use the result directly in the attribute. Do not store it and escape it
 * again later: it is already escaped, and escaping twice turns "&" in a
 * link into a literal "&amp;".
 */
function safeURL(value) {
  const url = String(value ?? '').trim();
  if (!url) return '';
  /* Relative links are resolved against the current page, so they keep
     this page's scheme (https on the live site, http on localhost). The
     fixed fallback is only for tools/test-site.mjs, which has no page. */
  const base = (typeof location !== 'undefined' && location.href) || 'https://heal-ai.stanford.edu/';
  let parsed;
  try { parsed = new URL(url, base); } catch { return ''; }
  return SAFE_URL_SCHEMES.includes(parsed.protocol) ? escapeHTML(url) : '';
}
