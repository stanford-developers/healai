#!/usr/bin/env node
/*
═════════════════════════════════════════════════════════════════════════════
 HEAL-AI · tools/test-site.mjs
─────────────────────────────────────────────────────────────────────────────
 WHAT THIS IS
   The website's tests. Plain Node 18+, no packages:

     node tools/test-site.mjs              test the files on disk
     node tools/test-site.mjs --ref main   test the files in a git commit

   The second form is how to show that a test fails without its fix: run it
   against the commit before the fix and watch the same check go red.

 HOW IT WORKS
   The site is ordinary browser scripts, so this loads the real files —
   js/config.js, js/data.js, js/safe-html.js, js/app.js (and js/admin.js for
   the dashboard) — into Node's `vm` with a very small pretend browser: page
   elements that remember what was written into them, and a pretend
   Supabase that hands back whatever rows a test wants. app.js's last line,
   init(), is left off: the tests call the functions they need directly.

   The checks look at the HTML the site produces, the way a browser would
   read it: which tags and attributes it would build, and what text a
   visitor would see. Not at how the code gets there.

   google-apps-script/signup-sheet.gs is loaded the same way with a pretend
   Google Sheet.

 Not published: tools/ is not in the deploy's SITE_PATHS.
═════════════════════════════════════════════════════════════════════════════
*/

import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const refArg = process.argv.indexOf('--ref');
const REF = refArg > -1 ? process.argv[refArg + 1] : null;

/** A file's text, from disk or from the git commit given with --ref.
 *  null when it does not exist there (js/safe-html.js before the fix). */
function source(rel) {
  try {
    if (REF) return execFileSync('git', ['-C', ROOT, 'show', `${REF}:${rel}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    return fs.readFileSync(path.join(ROOT, rel), 'utf8');
  } catch { return null; }
}


/* ─── A PRETEND BROWSER ─────────────────────────────────────────────────── */

/* Every write to innerHTML gets a number, so a test can tell which of two
   elements was drawn last — see reportPaneShows(). */
let writeCount = 0;

function fakeElement(id = '') {
  let html = '';
  const el = {
    id, value: '', hidden: false, disabled: false, tabIndex: 0, scrollTop: 0,
    textContent: '', dataset: {}, style: {}, parentElement: null, writtenAt: -1,
    get innerHTML() { return html; },
    set innerHTML(v) { html = String(v); el.writtenAt = ++writeCount; },
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    setAttribute() {}, getAttribute: () => null, removeAttribute() {},
    addEventListener() {}, removeEventListener() {},
    appendChild() {}, insertBefore() {}, remove() {}, focus() {}, scrollIntoView() {}, scrollBy() {},
    querySelector: () => fakeElement(), querySelectorAll: () => [], closest: () => null,
    getBoundingClientRect: () => ({ top: 0, left: 0, width: 0, height: 0 }),
  };
  return el;
}

/**
 * A pretend Supabase client. `tables` maps a table name to its rows, or to
 * a promise of rows (so a test can hold the "network" open and release it
 * later). Every query shape the site uses — select, order, eq — resolves
 * to { data, error }.
 */
function fakeSupabase(tables) {
  const query = table => {
    const q = {
      select: () => q, order: () => q, eq: () => q,
      then: (ok, fail) => Promise.resolve(tables[table] || [])
        .then(rows => ({ data: rows, error: null })).then(ok, fail),
    };
    return q;
  };
  const client = {
    from: query,
    storage: { from: bucket => ({
      getPublicUrl: p => ({ data: { publicUrl: `https://plqcpxurgusluqapksru.supabase.co/storage/v1/object/public/${bucket}/${p}` } }),
    }) },
    auth: { onAuthStateChange() {}, getSession: () => Promise.resolve({ data: { session: null } }) },
  };
  return { createClient: () => client };
}

/** Loads the given site files into a fresh pretend browser and returns it. */
function loadSite(files, { tables = {}, hash = '' } = {}) {
  writeCount = 0;
  const elements = new Map();
  const getEl = id => { if (!elements.has(id)) elements.set(id, fakeElement(id)); return elements.get(id); };
  const location = { href: 'https://heal-ai.stanford.edu/' + hash, hash, hostname: 'heal-ai.stanford.edu', search: '' };

  const sandbox = {
    console, URL, URLSearchParams, Promise, setTimeout, clearTimeout,
    location,
    history: {
      replaceState(_s, _t, url) { location.hash = url; },
      pushState(_s, _t, url) { location.hash = url; },
    },
    document: {
      getElementById: getEl,
      querySelector: () => null, querySelectorAll: () => [],
      createElement: () => fakeElement(), addEventListener() {},
      body: fakeElement('body'), head: fakeElement('head'),
    },
    matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
    requestAnimationFrame: fn => fn(),
    addEventListener() {},
    open() {},
    supabase: fakeSupabase(tables),
  };
  sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);

  for (const rel of files) {
    let code = source(rel);
    if (code === null) {
      if (rel === 'js/safe-html.js') continue;   // does not exist before the fix
      throw new Error(`cannot read ${rel}${REF ? ' at ' + REF : ''}`);
    }
    if (rel === 'js/app.js') code = code.replace(/\ninit\(\);\s*$/, '\n');
    vm.runInContext(code, ctx, { filename: rel });
  }
  return { run: expr => vm.runInContext(expr, ctx), el: getEl, ctx };
}

const SITE  = ['js/config.js', 'js/data.js', 'js/safe-html.js', 'js/app.js'];
const ADMIN = ['js/config.js', 'js/safe-html.js', 'js/admin.js'];


/* ─── READING HTML THE WAY A BROWSER WOULD ──────────────────────────────── */

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", apos: "'" };
const decode = s => s.replace(/&(amp|lt|gt|quot|#39|apos);/g, (_, e) => ENTITIES[e]);

/**
 * Every tag in `html` with its attributes. Enough of an HTML parser for
 * these templates, which always double-quote attribute values: an
 * attribute that escaped its quotes shows up here as an extra attribute,
 * and markup that escaped the text shows up as an extra tag.
 */
function tags(html) {
  const out = [];
  for (const m of html.matchAll(/<([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^\s"'>\/=]+(?:\s*=\s*"[^"]*")?)*)\s*\/?>/g)) {
    const attrs = {};
    for (const a of m[2].matchAll(/([^\s"'>\/=]+)(?:\s*=\s*"([^"]*)")?/g)) attrs[a[1].toLowerCase()] = decode(a[2] ?? '');
    out.push({ tag: m[1].toLowerCase(), attrs });
  }
  return out;
}

/** The text a visitor would read: tags removed, entities turned back into
 *  characters. */
const visibleText = html => decode(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ');

/* Schemes a browser would run as code, after the same clean-up a browser
   does (it ignores tabs, newlines and leading spaces, and letter case). */
const runsCode = url => /^(javascript|data|vbscript):/i.test(url.replace(/[\u0000- ]/g, ''));

/** Everything that would make a browser run code from this HTML. */
function codeThatWouldRun(html) {
  const found = [];
  for (const t of tags(html)) {
    if (['script', 'object', 'embed', 'base'].includes(t.tag)) found.push(`<${t.tag}> element`);
    for (const [name, value] of Object.entries(t.attrs)) {
      if (name.startsWith('on')) found.push(`${name}= on <${t.tag}>`);
      if (['href', 'src', 'data-href', 'action', 'formaction'].includes(name) && runsCode(value)) {
        found.push(`${name}="${value}" on <${t.tag}>`);
      }
    }
  }
  return found;
}


/* ─── TEST RUNNER ───────────────────────────────────────────────────────── */

const results = [];
async function test(name, fn) {
  try { await fn(); results.push({ name, ok: true }); }
  catch (err) { results.push({ name, ok: false, why: err.message.split('\n')[0] }); }
}
function check(cond, why) { if (!cond) throw new Error(why); }
function noCode(html, where) {
  const found = codeThatWouldRun(html);
  check(!found.length, `${where} would run code: ${found.join('; ')}`);
}

/* Things an attacker with an editor login might type into the dashboard. */
const XSS = {
  tag:      '<img src=x onerror=alert(1)>',
  script:   '"><script>alert(2)</script>',
  js:       'javascript:alert(3)',
  jsMixed:  ' JaVa\tScRiPt:alert(4)',
  data:     'data:text/html,<script>alert(5)</script>',
  breakout: 'https://example.org/a" onmouseover="alert(6)',
};


/* ─── W1 · DATABASE TEXT ON THE PUBLIC SITE ─────────────────────────────── */

await test('W1 resources: typed-in title and description show as text, links that run code are refused', async () => {
  const site = loadSite(SITE, { tables: { resources: [
    { category: 'interviews', title: XSS.tag, description: XSS.script, link_url: XSS.js, priority: 40 },
    { category: 'interviews', title: 'Mixed-case scheme', description: '', link_url: XSS.jsMixed, priority: 30 },
    { category: 'interviews', title: 'Data URL', description: '', link_url: XSS.data, priority: 20 },
    { category: 'interviews', title: 'Quote in link', description: '', link_url: XSS.breakout, priority: 10 },
  ] } });
  const res = await site.run('getPublicResources()');
  site.ctx.__res = res;
  const html = site.run(`resourceItemsHTML(resolveResourceItems(RESOURCE_CATEGORIES.find(c => c.id === 'interviews'), __res))`);
  noCode(html, 'resource cards');
  const text = visibleText(html);
  check(text.includes(XSS.tag), 'the title should be shown literally, as typed');
  check(text.includes('<script>alert(2)</script>'), 'the description should be shown literally, as typed');
  const hrefs = tags(html).map(t => t.attrs['data-href']).filter(Boolean);
  check(hrefs.length === 1 && hrefs[0] === XSS.breakout,
    `only the https link should be clickable, as one intact URL; got ${JSON.stringify(hrefs)}`);
});

await test('W1 reports: a database report shows its text literally, in the list and the detail pane', async () => {
  const site = loadSite(SITE, { tables: { reports: [
    { id: 'r1', name: XSS.tag, sub: XSS.script, overview: '</p><script>alert(7)</script>', summary: '<b onmouseover=alert(8)>x</b>',
      issues: ['<svg onload=alert(9)>'], priority: 10, file_path: 'a.pdf', file_name: 'a.pdf' },
  ] } });
  await site.run('enhanceReportsWithUploads()');
  const list = site.el('rb-pages').innerHTML;
  const pane = site.run('reportDetailHTML(ALL_REPORTS[0])');
  noCode(list, 'report list');
  noCode(pane, 'report detail pane');
  check(visibleText(pane).includes('<svg onload=alert(9)>'), 'the key issue should be shown literally');
  check(tags(pane).some(t => t.tag === 'a' && /report-files\/a\.pdf$/.test(t.attrs.href)), 'the download link should still be there');
});

await test('W1 team: names and links from the database cannot run code', async () => {
  const site = loadSite(SITE, { tables: { team_members: [
    { name: XSS.tag, role: XSS.script, badge: 'Staff', affiliation: '<i>x</i>', profile_url: XSS.js, photo_url: '" onerror="alert(1)' },
    { name: 'Real Person', role: 'Researcher', badge: 'Faculty', profile_url: 'https://profiles.stanford.edu/x', photo_url: 'assets/current_staff/x.webp' },
  ] } });
  await site.run('initTeamFeature()');
  const html = site.el('about-team').innerHTML;
  noCode(html, 'team grid');
  check(visibleText(html).includes(XSS.tag), 'the name should be shown literally');
  const links = tags(html).filter(t => t.tag === 'a').map(t => t.attrs.href);
  check(links.length === 1 && links[0] === 'https://profiles.stanford.edu/x', `only the real profile should be a link; got ${JSON.stringify(links)}`);
  check(tags(html).some(t => t.tag === 'img' && t.attrs.src === 'assets/current_staff/x.webp'), 'a normal photo should still show');
});

await test('W1 news: titles, transcripts, links and embeds from the database cannot run code', async () => {
  const site = loadSite(SITE, { tables: { news_items: [
    { type: 'seminar_video', title: XSS.tag, description: XSS.script, date: '2026-01-02', link: XSS.js,
      meta: { speaker: '<u>s</u>', embed: XSS.js, title: 'meta tried to replace the title', type: 'podcast' } },
    { type: 'seminar_video', title: 'Offsite player', description: '', date: '2026-01-03', link: 'https://example.org/talk',
      meta: { embed: 'https://evil.example/player' } },
    { type: 'seminar_video', title: 'YouTube talk', description: '', date: '2026-01-04', link: 'https://youtu.be/abcdefghijk',
      meta: { embed: 'https://www.youtube.com/embed/abcdefghijk' } },
    { type: 'podcast', title: 'Episode', description: '', date: '2026-01-05', link: '#',
      meta: { transcript: '<script>alert(10)</script>', audio: XSS.data } },
    { type: 'news_article', title: 'Article', description: '', date: '2026-01-06', link: XSS.jsMixed, meta: { source: XSS.tag } },
    { type: 'scholarly_publication', title: XSS.tag, description: '', date: '2026-01-07', link: XSS.js,
      meta: { authors: XSS.script, journal: 'J' } },
  ] } });
  /* Draws the browser and the publications list exactly as the page does
     (SHOW_NEWS is on in config.js). */
  await site.run('initNewsFeature()');
  const items = site.run('newsBrowserState.items');
  const panes = items.map(i => site.run(`newsPaneHTML(newsBrowserState.items.find(x => x.date === ${JSON.stringify(i.date)}))`)).join('\n');
  const grid = site.el('news-browser').innerHTML;
  const pubs = site.el('news-publications-list').innerHTML;
  noCode(panes, 'news detail panes');
  noCode(grid, 'news grid');
  noCode(pubs, 'publications list');
  const first = items.find(i => i.date === '2026-01-02');
  check(first.type === 'seminar_video' && visibleText(first.title).includes(XSS.tag),
    'keys inside meta must not replace the title or type');
  const frames = tags(panes).filter(t => t.tag === 'iframe').map(t => t.attrs.src);
  check(frames.length === 1 && frames[0] === 'https://www.youtube.com/embed/abcdefghijk',
    `only the YouTube player should be embedded; got ${JSON.stringify(frames)}`);
  check(visibleText(panes).includes('<script>alert(10)</script>'), 'the transcript should be shown literally');
});


/* ─── W1 · THE ADMIN DASHBOARD ──────────────────────────────────────────── */

await test('W1 admin lists: every list shows database text literally', async () => {
  const row = { id: 'x1', title: XSS.tag, description: XSS.script, name: XSS.tag, sub: XSS.script,
                role: XSS.script, badge: XSS.tag, affiliation: XSS.tag, category: XSS.tag, icon: XSS.tag,
                link_url: XSS.breakout, file_name: XSS.tag, file_path: '" onclick="x', type: 'news_article',
                date: '2026-01-01', meta: { source: XSS.tag }, priority: 1 };
  const site = loadSite(ADMIN, { tables: { team_members: [row] } });
  site.ctx.__row = row;
  site.run(`LIST_ROWS.resources = [__row]; LIST_ROWS.news = [__row]; LIST_ROWS.reports = [__row];
            renderResourceList(); renderNewsList(); renderReportList();`);
  await site.run('loadTeamMembers()');
  for (const id of ['resource-list', 'news-item-list', 'report-list', 'team-list']) {
    const html = site.el(id).innerHTML;
    noCode(html, id);
    check(visibleText(html).includes(XSS.tag), `${id} should show the text literally`);
  }
});


/* ─── LINK RULES ────────────────────────────────────────────────────────── */

await test('W1 safeURL keeps site links and https/mailto, refuses everything that runs code', () => {
  const site = loadSite(['js/safe-html.js']);
  const keep = ['https://a.org/x?y=1&z=2', 'http://a.org', 'mailto:heal@stanford.edu', '#toolkit',
                '#reports?open=abc', 'assets/x.png', '/admin', '//cdn.example.org/a.js'];
  const refuse = ['javascript:alert(1)', ' JavaScript:alert(1)', 'java\tscript:alert(1)', 'java\nscript:alert(1)',
                  'data:text/html,x', 'vbscript:msgbox(1)', 'file:///etc/passwd', 'blob:https://a.org/x', ''];
  for (const u of keep) check(decode(site.run(`safeURL(${JSON.stringify(u)})`)) === u, `should keep ${JSON.stringify(u)}`);
  for (const u of refuse) check(site.run(`safeURL(${JSON.stringify(u)})`) === '', `should refuse ${JSON.stringify(u)}`);
  check(site.run(`safeURL('https://a.org/" onmouseover="x')`).indexOf('"') === -1, 'a quote must not survive into the attribute');
});


/* ─── data.js STILL RENDERS AS WRITTEN ──────────────────────────────────── */

await test('data.js content still renders as authored (entities and its own links untouched)', () => {
  const site = loadSite(SITE);
  const blocks = site.run(`RESOURCE_CATEGORIES.map((c, i) => renderResourceCategoryBlock(c, true, i)).join('')`);
  const reports = site.run(`ALL_REPORTS.map(reportDetailHTML).join('')`);
  for (const html of [blocks, reports]) check(!html.includes('&amp;amp;'), 'something was escaped twice');
  check(blocks.includes('Interview &amp; focus group tracking sheet'), 'a data.js title lost its &amp;');
  check(blocks.includes('&ldquo;What to Expect&rdquo;'), 'a data.js title lost its curly quotes');
  check(blocks.includes('<a href="https://bmjdigitalhealth.bmj.com/content/2/1/e000099" target="_blank" rel="noopener">'),
    'the patient-panel bullet link from data.js should still be a link');
  check(reports.includes('Payment Probability &amp; Denial Appeal Drafter'), 'report 06 name lost its &amp;');
  const hrefs = tags(blocks).map(t => t.attrs['data-href']).filter(Boolean);
  check(hrefs.includes('https://healthpolicy.fsi.stanford.edu/news/ethical-obligations-inform-patients-about-use-ai-tools'),
    'the JAMA commentary card should still link out');
});


/* ─── W7 · A CITATION OPENED IN A NEW TAB ───────────────────────────────── */

/** Which report the detail pane is showing: whichever was drawn last, the
 *  pane on its own or the whole browser around it. */
function reportPaneShows(site) {
  const pane = site.el('rb-detail'), mount = site.el('rt-report-browser');
  const html = pane.writtenAt > mount.writtenAt ? pane.innerHTML : mount.innerHTML;
  const m = html.match(/class="rb-detail-name">([^<]*)</);
  return m ? m[1] : null;
}

/** A pretend network for the reports table: rows are held back until
 *  release() is called, like a slow first load. */
function heldReports() {
  let release;
  const rows = new Promise(r => { release = () => r([
    { id: 'db-a', name: 'Report A', sub: '', overview: '', summary: '', issues: [], priority: 30 },
    { id: 'db-b', name: 'Report B', sub: '', overview: '', summary: '', issues: [], priority: 20 },
    { id: 'db-c', name: 'Report C', sub: '', overview: '', summary: '', issues: [], priority: 10 },
  ]); });
  return { rows, release: () => release() };
}

await test('W7 #reports?open=<id> on a fresh page opens that report once the reports arrive', async () => {
  const net = heldReports();
  const site = loadSite(SITE, { tables: { reports: net.rows }, hash: '#reports?open=db-b' });
  /* What init() does on a cold load: draw the static list, start the
     database fetch, then resolve the link while the fetch is in flight. */
  site.run('renderReportBrowser()');
  const loaded = site.run('enhanceReportsWithUploads()');
  site.run('resolveSiteLink(location.hash)');
  net.release();
  await loaded;
  check(reportPaneShows(site) === 'Report B', `the pane shows ${JSON.stringify(reportPaneShows(site))}, not the cited Report B`);
});

await test('W7 a second citation clicked before the reports arrive wins over the first', async () => {
  const net = heldReports();
  const site = loadSite(SITE, { tables: { reports: net.rows }, hash: '#reports?open=db-b' });
  site.run('renderReportBrowser()');
  const loaded = site.run('enhanceReportsWithUploads()');
  site.run('resolveSiteLink(location.hash)');
  site.run(`resolveSiteLink('#reports?open=db-c')`);
  net.release();
  await loaded;
  check(reportPaneShows(site) === 'Report C', `the pane shows ${JSON.stringify(reportPaneShows(site))}, not the last-clicked Report C`);
});

await test('W7 a citation on an already-loaded page still opens straight away', async () => {
  const net = heldReports();
  const site = loadSite(SITE, { tables: { reports: net.rows } });
  site.run('renderReportBrowser()');
  net.release();
  await site.run('enhanceReportsWithUploads()');
  site.run(`resolveSiteLink('#reports?open=db-c')`);
  check(reportPaneShows(site) === 'Report C', `the pane shows ${JSON.stringify(reportPaneShows(site))}`);
});


/* ─── W3 / W5 · THE SIGNUP APPS SCRIPT ──────────────────────────────────── */

/** Loads signup-sheet.gs with a pretend Google Sheet. `fail` makes opening
 *  the Sheet throw, with an error message that must not reach the caller. */
function loadSignup({ fail = false } = {}) {
  const rows = [];
  const sheet = {
    getLastRow: () => rows.length, appendRow: r => rows.push(r), setFrozenRows() {}, getName: () => 'Signups',
  };
  const ss = { getSheetByName: () => sheet, insertSheet: () => sheet };
  const sandbox = {
    console: { error() {}, log() {} },
    SpreadsheetApp: {
      openById: () => { if (fail) throw new Error('Exception: no access to sheet 1Wg2-internal-detail'); return ss; },
      getActiveSpreadsheet: () => ss,
    },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: text => ({ text, setMimeType() { return this; } }),
    },
  };
  const ctx = vm.createContext(sandbox);
  const code = source('google-apps-script/signup-sheet.gs');
  check(code !== null, 'cannot read signup-sheet.gs');
  vm.runInContext(code, ctx, { filename: 'signup-sheet.gs' });
  const post = body => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify(body) } }).text);
  const get = () => JSON.parse(ctx.doGet().text);
  return { rows, post, get };
}

await test('W3 signup: values that start like a formula are stored as plain text', () => {
  const s = loadSignup();
  const res = s.post({ name: '=HYPERLINK("https://evil.example","click")', email: 'a@b.org', affiliation: '+1+1' });
  check(res.ok, 'a valid signup should still be accepted');
  const [, name, email, affiliation] = s.rows[s.rows.length - 1];
  check(name === `'=HYPERLINK("https://evil.example","click")`, `name was written as ${JSON.stringify(name)}`);
  check(affiliation === "'+1+1", `affiliation was written as ${JSON.stringify(affiliation)}`);
  check(email === 'a@b.org', 'an ordinary value must be written exactly as typed');
  for (const v of ['-2', '@x']) {
    s.post({ name: v, email: 'c@d.org', affiliation: 'Stanford' });
    check(s.rows[s.rows.length - 1][1] === "'" + v, `${v} was not neutralised`);
  }
});

await test('W5 signup: the health check and errors say nothing about the Sheet', () => {
  const health = loadSignup().get();
  check(JSON.stringify(health) === '{"ok":true}', `health check returned ${JSON.stringify(health)}`);
  const broken = loadSignup({ fail: true });
  const g = broken.get();
  const p = broken.post({ name: 'A', email: 'a@b.org', affiliation: 'B' });
  check(!JSON.stringify(g).includes('1Wg2') && !JSON.stringify(p).includes('1Wg2'), 'an internal error message reached the caller');
  check(p.ok === false && typeof p.error === 'string' && p.error.length > 0, 'a failed signup should still say it failed');
});


/* ─── REPORT ────────────────────────────────────────────────────────────── */

const failed = results.filter(r => !r.ok);
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : '\n      ' + r.why}`);
console.log(`\n${results.length - failed.length}/${results.length} passed${REF ? ` (code from ${REF})` : ''}`);
process.exit(failed.length ? 1 : 0);
