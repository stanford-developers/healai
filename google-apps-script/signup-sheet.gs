/**
 * ═══════════════════════════════════════════════════════════════════════════
 * HEAL-AI · signup-sheet.gs
 * ───────────────────────────────────────────────────────────────────────────
 * Appends one row to a Google Sheet for every sign-up submitted from the
 * site's "Sign up for updates" form (name / email / affiliation).
 *
 * WHY THIS EXISTS
 *   The site is a static page with no backend, so it can't hold a Google
 *   credential. This script runs as you, inside your own Google account,
 *   and exposes exactly one narrow operation — "append a signup row" — as
 *   a public URL the page can POST to.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * SETUP (about 10 minutes, once)
 *
 *   1. Create a Google Sheet to collect signups. Name the first tab
 *      "Signups" (or change SHEET_NAME below).
 *
 *   2. In that Sheet: Extensions → Apps Script. Delete the placeholder
 *      `myFunction` and paste this entire file in. Save.
 *
 *   3. Deploy → New deployment → gear icon → Web app. Set:
 *         Description:   HEAL-AI signup endpoint
 *         Execute as:    Me
 *         Who has access: Anyone
 *      "Anyone" is required — visitors are not signed in to Google. It does
 *      not give anyone access to the Sheet itself, only the ability to call
 *      doPost() below, which can only append a signup row.
 *
 *   4. Click Deploy, approve the permission prompt, and copy the Web app
 *      URL. It looks like:
 *         https://script.google.com/macros/s/AKfycb…/exec
 *
 *   5. Paste that URL into SIGNUP_ENDPOINT in /js/config.js and deploy the
 *      site. Until you do, the sign-up buttons fall back to SIGN_UP_URL.
 *
 *   NOTE · after editing this script you must Deploy → Manage deployments →
 *   edit → Version: New version. Saving alone does not update the live URL.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * ABUSE
 *   A public endpoint that appends rows can be submitted by anyone, so
 *   expect the occasional junk row — this is a mailing-list signup, so the
 *   downside is a row you delete, not a security hole. Guards below: a
 *   required-field check, a length cap, an email-shape check, and a
 *   honeypot field that real users never fill in. If it ever gets
 *   hammered, the quickest fix is Deploy → Manage deployments → Archive,
 *   which kills the URL instantly.
 * ═══════════════════════════════════════════════════════════════════════════
 */

var SHEET_NAME = 'Signups';
var MAX_LEN = 200;

/**
 * Handles the site's POST. Sent as text/plain rather than application/json
 * on purpose: that's a CORS "simple request", so the browser skips the
 * preflight OPTIONS call, which Apps Script web apps cannot answer.
 */
function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');

    /* Honeypot: a hidden field in the form. A human leaves it empty; a
       naive bot fills every input it finds. Answer 200 so the bot has no
       signal that it was rejected. */
    if (body.company) return json({ ok: true });

    var name        = clean(body.name);
    var email       = clean(body.email);
    var affiliation = clean(body.affiliation);

    if (!name || !email || !affiliation) {
      return json({ ok: false, error: 'Name, email, and affiliation are all required.' });
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return json({ ok: false, error: 'That email address does not look right.' });
    }

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME)
             || SpreadsheetApp.getActiveSpreadsheet().insertSheet(SHEET_NAME);

    /* Header row on first use, so a fresh Sheet is readable immediately. */
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['Timestamp', 'Name', 'Email', 'Affiliation']);
      sheet.setFrozenRows(1);
    }

    sheet.appendRow([new Date(), name, email, affiliation]);
    return json({ ok: true });

  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

/** A GET on the endpoint is someone opening the URL in a browser. Say so
 *  plainly rather than showing an Apps Script error page. */
function doGet() {
  return json({ ok: true, message: 'HEAL-AI signup endpoint. Submit the form on the site instead.' });
}

function clean(v) {
  return String(v == null ? '' : v).trim().slice(0, MAX_LEN);
}

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
