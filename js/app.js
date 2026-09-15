/*
═════════════════════════════════════════════════════════════════════════════
 HEAL-AI · js/app.js
─────────────────────────────────────────────────────────────────────────────
 PURPOSE
   The "Dynamic Controller". Reads constants from config.js + content arrays
   from data.js and renders every interactive piece of the site:
     • Loader splash
     • Navigation (desktop + mobile)
     • Page routing
     • Home page sections (hero copy, about, stats, get-started, signup)
     • Process page (FURM steps)
     • Videos page (gated by SHOW_VIDEOS; opens an accessible modal)
     • Resources page (tabbed library + 8 redacted sample reports)
     • Patient Panel page (Stanford side + external-side accordion)
     • Playbook page (adaptation cards)
     • About page (cards + team grid)
     • Hero canvas (cardinal mesh animation)

 ARCHITECTURAL NOTES
   • This file is plain ES2017 — no bundler, no framework. Each renderer
     is a self-contained function named render<Thing>() so the team can
     locate, rerun, or rewrite any UI region independently.
   • Renderers DO NOT hold state. The state we have is:
        currentPage       → which page is .active right now
        mobileOpen        → whether the hamburger menu is open
        hoveredCanvasNode → which research node is under the cursor
     That's it. No "framework" needed.
   • All DOM IDs referenced here are mount points declared in index.html.
     If you rename an ID in the HTML, change it here too — or, better,
     don't rename it.
   • innerHTML is used freely with our own data. We DO NOT accept
     user-submitted strings anywhere on this page, so XSS isn't a vector.
     If that changes later, switch to textContent + DOM construction.

 ACCESSIBILITY (a11y) NOTES SCATTERED THROUGH THIS FILE
   • Tab buttons (resources, nav) get aria-selected / role="tab".
   • The video modal sets aria-hidden + sets focus into the dialog.
   • The patient-panel accordion sets aria-expanded on each header button.
   • All keyboard-clickable cards listen for Enter AND Space.
   • The Escape key closes the modal first, then the mobile menu.

 ORDER OF EXECUTION
   The bottom of this file calls init(), which runs each renderer once.
   They are independent — re-running renderTeam() (for example) will
   re-populate #about-team safely.
═════════════════════════════════════════════════════════════════════════════
*/


/* ─────────────────────────────────────────────────────────────────────────
   ① LOCAL STATE (the entire app's state, deliberately minimal)
─────────────────────────────────────────────────────────────────────────── */
let currentPage = DEFAULT_PAGE;   /* from config.js */
let mobileOpen  = false;


/* ─────────────────────────────────────────────────────────────────────────
   ② TINY HELPERS
─────────────────────────────────────────────────────────────────────────── */
const $   = (sel) => document.querySelector(sel);
const $$  = (sel) => Array.from(document.querySelectorAll(sel));
const byId = (id) => document.getElementById(id);

/**
 * Shared ordering rule for every admin-editable list that merges static
 * (data.js) content with Supabase rows (News items, Sample Reports, Team):
 * an explicit numeric `priority` (higher = earlier) always wins; among
 * items that don't have one, `fallback` decides (e.g. newest-first by
 * date, or just "leave them where they were" via a same-order stable
 * sort). Array.prototype.sort is stable in every modern engine, so
 * returning 0 from `fallback` preserves insertion order rather than
 * shuffling unprioritized items.
 */
function prioritySort(items, fallback = () => 0) {
  return [...items].sort((a, b) => {
    const ap = a.priority ?? null, bp = b.priority ?? null;
    if (ap !== null && bp !== null && ap !== bp) return bp - ap;
    if (ap !== null && bp === null) return -1;
    if (bp !== null && ap === null) return 1;
    return fallback(a, b);
  });
}

/** Site-wide "Pause Media" toggle (footer-global) — live check, unlike the
 *  prefers-reduced-motion matchMedia captured once at hero-canvas init. */
function isMotionPaused() { return document.body.classList.contains('motion-paused'); }

/**
 * Build an inline 24×24 SVG using a named entry from the ICONS library
 * in data.js. Returns an SVG string ready to drop into innerHTML.
 */
function svgIcon(name, opts = {}) {
  const inner = ICONS[name] || '';
  const stroke = opts.stroke || 'currentColor';
  return `<svg viewBox="0 0 24 24" aria-hidden="true" stroke="${stroke}" stroke-width="${opts.sw||1.8}" fill="${opts.fill||'none'}" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}

/**
 * True once SIGNUP_ENDPOINT in config.js points at a real deployed Apps
 * Script Web App. Everything sign-up related branches on this, so the site
 * works both before and after that URL is pasted in — see
 * /google-apps-script/signup-sheet.gs for the deploy steps.
 */
function hasSignUpEndpoint() {
  return typeof SIGNUP_ENDPOINT === 'string'
    && SIGNUP_ENDPOINT.length > 0
    && !SIGNUP_ENDPOINT.includes('REPLACE-WITH');
}

/**
 * Every "Sign up" CTA funnels through here: the modal form when we can
 * collect sign-ups ourselves, otherwise the old behavior of opening
 * SIGN_UP_URL in a new tab. Single helper so neither URL is duplicated
 * anywhere.
 */
function openSignUp() {
  if (hasSignUpEndpoint()) { openSignUpModal(); return; }
  window.open(SIGN_UP_URL, '_blank', 'noopener');
}


/* ═════════════════════════════════════════════════════════════════════════
   ③ LOADER
   ─────────────────────────────────────────────────────────────────────────
   The liquid-fill animation itself is pure CSS (@keyframes loader-rise,
   autoplays the instant the element paints) — this only owns the hold
   time and the fade-out dismissal. Honors FEATURES.showLoader.
   ════════════════════════════════════════════════════════════════════════ */
function bootLoader() {
  const loader = byId('loader');
  if (!FEATURES.showLoader) { loader.remove(); return; }

  document.body.style.overflow = 'hidden';
  setTimeout(() => {
    loader.classList.add('exit');
    document.body.style.overflow = '';
  }, TIMINGS.loaderHoldMs);
}


/* ═════════════════════════════════════════════════════════════════════════
   ④ ROUTING + NAVIGATION
   ─────────────────────────────────────────────────────────────────────────
   • goPage(name)       → user-facing navigation: pushes a URL hash entry
                          (so Back/Forward work), then applies the page.
   • setActivePage(name)→ the actual DOM swap, with no history side effects.
                          Used by goPage(), by the initial-load hash check,
                          and by the popstate handler below.
   • renderNav()        → build desktop tabs + mobile menu from NAV_ITEMS
                          (respects videoOnly:true ↔ SHOW_VIDEOS)
   • Mobile menu toggle, Escape-to-close, sign-up URL wiring all live here.

   WHY THE HASH
     Pages used to be swapped by toggling .active with no URL change, so
     every page looked identical to the browser: one history entry for the
     whole site. Back/Forward had nothing to navigate between, and reloading
     or sharing a link always dropped you on Home. The hash (#process,
     #resources, ...) gives each page its own history entry and URL.

   a11y NOTE
     We update both aria-selected on tabs AND the .active class on pages
     so screen readers + sighted users stay in sync.
   ════════════════════════════════════════════════════════════════════════ */
function setActivePage(name) {
  if (!PAGE_IDS.includes(name)) name = DEFAULT_PAGE;
  if (name === currentPage) return;
  const cur  = byId('page-' + currentPage);
  const next = byId('page-' + name);
  if (!next) return;

  cur.classList.remove('active');
  next.classList.add('active');
  next.scrollTop = 0;
  /* Setting scrollTop programmatically doesn't synchronously fire a
     'scroll' event, so without this, landing back on Home would keep
     showing whatever hero crossfade state was left over from before you
     scrolled away instead of resetting to the full-bleed intro. */
  if (name === 'home') updateHeroScrollIntro();

  /* Sync top-nav buttons (in both desktop and mobile locations).
     a11y: top nav is NOT a tablist — it's primary site navigation, so
     we use aria-current="page" instead of aria-selected. Screen readers
     announce "current page" for the active link. */
  $$('.nav-tab').forEach(t => {
    const on = t.dataset.id === name;
    t.classList.toggle('active', on);
    if (on) t.setAttribute('aria-current', 'page');
    else    t.removeAttribute('aria-current');
  });

  currentPage = name;
  closeMobileMenu();
  updateFooterVisibility(name);
}

/**
 * Home keeps its original footer; every other page shows #footer-global.
 * Called from setActivePage() on every navigation, and once directly in
 * init() since the very first page load never runs through setActivePage
 * when there's no URL hash to apply.
 *
 * WHY THE DOM MOVE — every .page is `position:fixed; inset:0` with its own
 * internal scroll (that's how instant page-swapping works here). A <footer>
 * left as a sibling AFTER </main> sits behind whichever .page is active and
 * is never reachable by scrolling — true for the ORIGINAL footer too, not
 * something this introduced. Moving the relevant footer to be the active
 * page's last child makes it part of that page's own scrollable content, so
 * it actually appears once the user scrolls to the bottom.
 */
function updateFooterVisibility(name) {
  const isHome = name === 'home';
  const homeFooter   = byId('footer-home');
  const globalFooter = byId('footer-global');
  const activePage    = byId('page-' + name);

  homeFooter.classList.toggle('hidden-footer', !isHome);
  globalFooter.classList.toggle('hidden-footer', isHome);

  const target = isHome ? homeFooter : globalFooter;
  if (activePage && target.parentElement !== activePage) {
    activePage.appendChild(target);
  }
}

function goPage(name) {
  if (!PAGE_IDS.includes(name)) return;
  if (name === currentPage) { closeMobileMenu(); return; }
  history.pushState({page: name}, '', '#' + name);
  setActivePage(name);
}

/* Back/Forward: the browser has already changed location.hash for us —
   just apply it, without pushing a further history entry. */
window.addEventListener('popstate', () => {
  setActivePage(location.hash.slice(1) || DEFAULT_PAGE);
});

function renderNav() {
  const center = byId('nav-center');
  const mobile = byId('mobile-menu');
  center.innerHTML = '';
  mobile.innerHTML = '';

  /* Filter NAV_ITEMS by the SHOW_VIDEOS phase flag. */
  const items = NAV_ITEMS.filter(i => !(i.videoOnly && !SHOW_VIDEOS));

  items.forEach(item => {
    /* Desktop tab */
    const desktop = makeNavBtn(item);
    center.appendChild(desktop);
    /* Mobile clone (separate node so click handlers don't share state) */
    mobile.appendChild(makeNavBtn(item));
  });

  /* Mobile sign-up button (appears at the bottom of the menu) */
  const ms = document.createElement('a');
  ms.href = SIGN_UP_URL;
  ms.target = '_blank'; ms.rel = 'noopener';
  ms.className = 'btn-cta';
  ms.textContent = 'Sign up for updates →';
  mobile.appendChild(ms);
  ms.addEventListener('click', e => {
    if (!hasSignUpEndpoint()) return;      /* let the href do its job */
    e.preventDefault();
    closeMobileMenu();
    openSignUp();
  });

  /* Every Sign-up CTA. With an endpoint configured these open the modal
     form instead of navigating; the href stays set as a no-JS fallback,
     so preventDefault() is what actually suppresses the navigation. */
  ['nav-signup-btn', 'home-signup-btn', 'footer-signup', 'footer-global-signup']
    .forEach(id => {
      const el = byId(id);
      if (!el) return;
      el.href = SIGN_UP_URL;
      el.target = '_blank';
      el.rel = 'noopener';
      el.addEventListener('click', e => {
        if (!hasSignUpEndpoint()) return;
        e.preventDefault();
        openSignUp();
      });
    });

  /* Brand mark → home */
  byId('brand-home').addEventListener('click', () => goPage('home'));

  /* Footer in-site links use data-page attributes */
  $$('footer [data-page]').forEach(a =>
    a.addEventListener('click', e => { e.preventDefault(); goPage(a.dataset.page); })
  );
}

function makeNavBtn(item) {
  /*
    Top-nav button.
    a11y: this is primary site navigation, not an in-page tablist, so
    we annotate the ACTIVE button with `aria-current="page"` (the
    semantically correct attribute for "this link represents the
    current page") rather than `role="tab"`/`aria-selected`.
  */
  const b = document.createElement('button');
  b.className = 'nav-tab' + (item.id === currentPage ? ' active' : '');
  b.dataset.id = item.id;
  b.textContent = item.label;
  if (item.id === currentPage) b.setAttribute('aria-current', 'page');
  b.addEventListener('click', () => goPage(item.id));
  return b;
}

/* Mobile hamburger toggle ──────────────────────────────────────────────── */
function bindMobileToggle() {
  const toggle = byId('nav-toggle');
  const menu   = byId('mobile-menu');
  const icon   = byId('nav-toggle-icon');
  toggle.addEventListener('click', () => {
    mobileOpen = !mobileOpen;
    menu.classList.toggle('open', mobileOpen);
    toggle.setAttribute('aria-expanded', mobileOpen ? 'true' : 'false');
    menu.setAttribute('aria-hidden', mobileOpen ? 'false' : 'true');
    icon.innerHTML = mobileOpen
      ? '<path d="M6 6l12 12M6 18L18 6"/>'  /* close ✕ */
      : '<path d="M3 7h18M3 12h18M3 17h18"/>'; /* hamburger ☰ */
  });
}
function closeMobileMenu() {
  if (!mobileOpen) return;
  mobileOpen = false;
  byId('mobile-menu').classList.remove('open');
  byId('nav-toggle').setAttribute('aria-expanded', 'false');
  byId('mobile-menu').setAttribute('aria-hidden', 'true');
  byId('nav-toggle-icon').innerHTML = '<path d="M3 7h18M3 12h18M3 17h18"/>';
}


/* ═════════════════════════════════════════════════════════════════════════
   ⑤ HOME PAGE renderers
   ════════════════════════════════════════════════════════════════════════ */

/**
 * Renders the hero eyebrow, headline, sub, and the two CTA buttons.
 * Pulled from HERO_COPY in data.js. Button behavior is determined by
 * the `action` field:
 *   "page:foo" → goPage('foo')
 *   "url"      → openSignUp()
 */
function renderHero() {
  byId('hero-eyebrow').textContent      = HERO_COPY.eyebrow;
  byId('hero-intro-tagline').textContent = HERO_COPY.eyebrow;
  byId('home-hero-h').innerHTML   = HERO_COPY.headline;
  byId('hero-sub').textContent    = HERO_COPY.sub;

  const wrap = byId('hero-btns');
  wrap.innerHTML = '';
  HERO_COPY.buttons.forEach(b => {
    const el = document.createElement('button');
    el.className = b.variant === 'prime' ? 'btn-prime' : 'btn-second';
    el.textContent = b.label;
    el.addEventListener('click', () => routeAction(b.action));
    wrap.appendChild(el);
  });
}

/**
 * Full-bleed intro → compact hero crossfade, tracked 1:1 with scroll.
 *
 * WHY #page-home's OWN scroll event, not window.scroll — every `.page` is
 * `position:fixed` with its own internal overflow-y:auto (that's what
 * makes instant page-switching work here); the window itself never
 * scrolls on this site. See setActivePage()'s comment for the full story.
 *
 * --hero-progress (0 = just landed, 1 = fully settled) is a CSS custom
 * property read by .hero-intro, .hero-content, #hero-canvas, and
 * .scroll-cue's opacity/transform in style.css — updating one variable
 * per frame is cheap and keeps every element's animation perfectly in
 * sync without threading progress through each one separately in JS.
 */
const HERO_SETTLE_DISTANCE = 560;   /* px of scroll to fully cross-fade */

/**
 * Recomputes the hero's --hero-progress/--hero-out/--hero-in custom
 * properties from #page-home's current scrollTop. Exposed at module level
 * (not trapped in initHeroScrollIntro()'s closure) so setActivePage() can
 * call it directly — setting `.scrollTop = 0` programmatically doesn't
 * synchronously fire a 'scroll' event, so without this, returning to Home
 * would keep showing whatever crossfade state was left over from before
 * you navigated away instead of resetting to the full-bleed intro.
 */
function updateHeroScrollIntro() {
  const page = byId('page-home');
  const hero = document.querySelector('.hero');
  if (!page || !hero) return;
  const progress = Math.min(1, Math.max(0, page.scrollTop / HERO_SETTLE_DISTANCE));
  /* Staggered, not simultaneous: the intro tagline fully fades out by 35%
     of the scroll distance, then the real headline doesn't start fading
     in until 50% — otherwise both are ~50% opaque at the same moment and
     overlap into an unreadable double-exposure. The canvas zoom
     (--hero-progress, used as-is below) stays continuous over the full
     range since it doesn't clash with anything visually. */
  const outProgress = Math.min(1, progress / 0.35);
  const inProgress  = Math.min(1, Math.max(0, (progress - 0.5) / 0.35));
  hero.style.setProperty('--hero-progress', progress);
  hero.style.setProperty('--hero-out', outProgress);
  hero.style.setProperty('--hero-in', inProgress);
  hero.classList.toggle('hero-settled', progress > 0.05);
}

function initHeroScrollIntro() {
  const page  = byId('page-home');
  const track = byId('hero-scroll-track');
  if (!page || !track) return;

  /* .hero is position:sticky inside this track — the track needs to be
     taller than the viewport by exactly HERO_SETTLE_DISTANCE so .hero
     stays pinned for that whole scroll range instead of scrolling away
     before the crossfade finishes. */
  track.style.height = `calc(100vh + ${HERO_SETTLE_DISTANCE}px)`;

  let ticking = false;
  page.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { updateHeroScrollIntro(); ticking = false; });
  }, { passive: true });

  updateHeroScrollIntro();   /* correct initial state on load, before any scroll fires */
}

function routeAction(action) {
  if (!action) return;
  if (action.startsWith('page:')) {
    /* "page:toolkit:resources" → goPage('toolkit') then activate its
       Resources Level-1 tab, so buttons/cards can deep-link into a
       specific Toolkit section instead of always landing on Process.

       A bare "page:toolkit" falls back to 'process' rather than leaving
       the tab alone. The active tab persists for the life of the page, so
       doing nothing here meant "See the process" and "Learn the process"
       landed on whichever tab the visitor had opened last — click "Browse
       resources" once and every later process link went to Resources. */
    const [, name, tkTab] = action.split(':');
    goPage(name);
    if (name === 'toolkit') activateToolkitTab(tkTab || 'process', false);
    else if (tkTab) activateToolkitTab(tkTab, false);
  }
  else if (action === 'url') openSignUp();
}

/** Positioning statement + 3 pillar cards. */
function renderHomeAbout() {
  byId('about-h').innerHTML = HOME_ABOUT.statement;
  const side = byId('about-bullets');
  side.innerHTML = HOME_ABOUT.bullets.map((b, i) => `
    <div class="about-bullet">
      <div class="about-bullet-icon" aria-hidden="true">${String(i + 1).padStart(2, '0')}</div>
      <div>
        <h4>${b.title}</h4>
        <p>${b.body}</p>
      </div>
    </div>
  `).join('');
}

/** Three stats under the hero. */
function renderStats() {
  byId('stats-row').innerHTML = STATS.map(s => `
    <div class="stat">
      <div class="stat-n">${s.n}</div>
      <div class="stat-l">${s.label}</div>
    </div>
  `).join('');
}

/**
 * The 5-step Get Started flow.
 *
 * a11y NOTE
 *   Each card is keyboard-activatable (tabIndex 0 + Enter/Space handler)
 *   so non-mouse users can trigger the same navigation as a click.
 *   Arrow icons between cards are decorative — they don't have separate
 *   tab stops and they're hidden in mobile layouts (no overlap on stack).
 */
function renderGetStarted() {
  const grid = byId('flow-grid');
  grid.innerHTML = '';
  GET_STARTED_STEPS.forEach((s, idx) => {
    const c = document.createElement('div');
    c.className = 'flow-step';
    c.setAttribute('role', 'listitem');
    c.tabIndex = 0;
    c.innerHTML = `
      <div class="flow-num">STEP ${s.n}</div>
      <div class="flow-icon">${svgIcon(s.icon)}</div>
      <h4>${s.title}</h4>
      <p>${s.desc}</p>
      ${idx < GET_STARTED_STEPS.length - 1
        ? `<div class="flow-arrow" aria-hidden="true">${svgIcon('arrowR', {sw:2, stroke:'var(--cardinal)'})}</div>`
        : ''}
    `;
    const fire = () => routeAction(s.action);
    c.addEventListener('click', fire);
    c.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fire(); }
    });
    grid.appendChild(c);
  });
}


/* ═════════════════════════════════════════════════════════════════════════
   ⑤b TOOLKIT PAGE — Level-1 tabs (Process | Playbook | Resources)
   ─────────────────────────────────────────────────────────────────────────
   A true WAI-ARIA Tablist, same pattern as the Resources tab's Level-2
   tabs below — see activateResourceGroupTab()'s a11y comment for the
   roving-tabindex/aria-selected rationale, not repeated here.
   ════════════════════════════════════════════════════════════════════════ */
const TOOLKIT_TABS = [
  { id: 'process',   label: 'Process' },
  { id: 'playbook',  label: 'Playbook' },
  { id: 'resources', label: 'Resources' },
];

function renderToolkitTabs() {
  const bar = byId('tk-bar');
  bar.innerHTML = '';
  bar.setAttribute('role', 'tablist');
  bar.setAttribute('aria-label', 'Toolkit sections');

  TOOLKIT_TABS.forEach((t, i) => {
    const isFirst = i === 0;
    const tab = document.createElement('button');
    tab.className = 'tk-tab' + (isFirst ? ' on' : '');
    tab.id = 'tk-tab-' + t.id;
    tab.dataset.tabId = t.id;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', isFirst ? 'true' : 'false');
    tab.setAttribute('aria-controls', 'tk-pan-' + t.id);
    tab.tabIndex = isFirst ? 0 : -1;
    tab.textContent = t.label;
    tab.addEventListener('click',   () => activateToolkitTab(t.id, true));
    tab.addEventListener('keydown', e  => handleToolkitTabKeydown(e, i));
    bar.appendChild(tab);
  });
}

function activateToolkitTab(id, focus = false) {
  $$('.tk-tab').forEach(t => {
    const on = t.dataset.tabId === id;
    t.classList.toggle('on', on);
    t.setAttribute('aria-selected', on ? 'true' : 'false');
    t.tabIndex = on ? 0 : -1;
    if (on && focus) t.focus();
  });
  $$('.tk-panel').forEach(p => p.classList.toggle('on', p.id === 'tk-pan-' + id));

  /* .tk-panel is display:none while inactive, so any accordion body
     inside it that pre-measured its scrollHeight at init time (see
     renderToolkitPlaybook()) measured 0 — display:none collapses layout
     entirely, unlike .page's opacity/visibility approach. Re-measure any
     already-open accordion body now that its panel is actually laid out. */
  requestAnimationFrame(() => {
    $$('.tk-panel.on .pb-acc-item.open .pb-acc-body-inner').forEach(inner => {
      inner.parentElement.style.maxHeight = inner.scrollHeight + 'px';
    });
  });
}

function handleToolkitTabKeydown(e, idx) {
  const tabs = $$('.tk-tab');
  const len  = tabs.length;
  let target = -1;
  switch (e.key) {
    case 'ArrowRight': target = (idx + 1) % len;       break;
    case 'ArrowLeft':  target = (idx - 1 + len) % len; break;
    case 'Home':       target = 0;                     break;
    case 'End':        target = len - 1;               break;
    default: return;
  }
  e.preventDefault();
  activateToolkitTab(tabs[target].dataset.tabId, true);
}


/* ═════════════════════════════════════════════════════════════════════════
   ⑥ TOOLKIT PAGE — Process tab (FURM 5-step grid)
   ════════════════════════════════════════════════════════════════════════ */
function renderProcessSteps() {
  const wrap = byId('process-steps');
  wrap.innerHTML = '';
  FURM_STEPS.forEach(s => {
    /* Build a dot gauge (one per step) with the first `gates` dots highlighted */
    const dots = Array.from({length: FURM_STEPS.length}, (_, i) =>
      `<div class="d${i < s.gates ? ' on' : ''}"></div>`
    ).join('');

    const c = document.createElement('div');
    c.className = 'proc-step';
    c.innerHTML = `
      <div class="proc-num">STEP ${s.n}</div>
      <h4>${s.title}</h4>
      <p>${s.desc}</p>
      <div class="dotrow" aria-hidden="true">${dots}</div>
    `;
    wrap.appendChild(c);
  });
}


/* ═════════════════════════════════════════════════════════════════════════
   ⑦ VIDEOS PAGE renderer + accessible modal player
   ─────────────────────────────────────────────────────────────────────────
   When SHOW_VIDEOS is false → renders a "Coming soon" notice.
   When true               → renders the 6-card grid; cards open the modal.

   a11y NOTE on the modal
     • role="dialog" / aria-modal="true" set in index.html.
     • We toggle aria-hidden on the modal, NOT visibility, so screen readers
       can see when it's hidden.
     • Iframe src is CLEARED on close so video playback stops (otherwise
       the iframe keeps running in the background).
     • Escape closes the modal first (handled by the document keydown
       listener installed in init()).
   ════════════════════════════════════════════════════════════════════════ */
function renderVideos() {
  const sec = byId('videos-section');
  sec.innerHTML = '';

  /* ── Phase 1 (SHOW_VIDEOS = false) — render a clean coming-soon notice */
  if (!SHOW_VIDEOS) {
    sec.innerHTML = `
      <div class="videos-hidden-notice">
        <div class="badge">Phase 2 · Coming soon</div>
        <h3>Training videos launch with the next release.</h3>
        <p>A six-part series — FURM, the five-step process, stakeholder interviews,
        the patient panel, writing the EOP, and adapting the process — is in
        production. Sign up for updates and we'll let you know the moment it goes live.</p>
        <div style="margin-top:24px">
          <a href="${SIGN_UP_URL}" target="_blank" rel="noopener" class="btn-prime" id="videos-notify-btn">Notify me →</a>
        </div>
      </div>`;
    /* Same treatment as the other CTAs: open our own form when we have an
       endpoint, otherwise let the href fall through to SIGN_UP_URL. */
    byId('videos-notify-btn').addEventListener('click', e => {
      if (!hasSignUpEndpoint()) return;
      e.preventDefault();
      openSignUp();
    });
    return;
  }

  /* ── Phase 2 — render the 6-card grid */
  const grid = document.createElement('div');
  grid.className = 'videos-grid';

  VIDEOS.forEach(v => {
    const card = document.createElement('article');
    card.className = 'video-card';
    card.tabIndex = 0;
    card.setAttribute('aria-label', `Watch video ${v.num}: ${v.title}`);
    card.innerHTML = `
      <div class="video-poster" role="img" aria-label="Poster for ${v.title}">
        <div class="video-meta">EP ${v.num}</div>
        <div class="play" aria-hidden="true">${svgIcon('play', {fill: 'var(--cardinal)', sw: 0})}</div>
        <div class="video-duration">${v.duration}</div>
      </div>
      <div class="video-body">
        <h3>${v.title}</h3>
        <p>${v.desc}</p>
        <div class="video-resources">
          ${v.resources.map(r => `<button class="vr-chip" data-chip="${r}">${r}</button>`).join('')}
        </div>
      </div>`;

    /* Card click → open modal */
    const fire = () => openVideo(v);
    card.addEventListener('click', e => {
      /* Don't open the modal if user actually clicked a resource chip */
      if (e.target.closest('.vr-chip')) return;
      fire();
    });
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fire(); }
    });

    /* Resource chips route to the Toolkit page's Resources tab */
    card.querySelectorAll('.vr-chip').forEach(chip => {
      chip.addEventListener('click', e => {
        e.stopPropagation();
        goPage('toolkit');
        activateToolkitTab('resources', false);
      });
    });

    grid.appendChild(card);
  });
  sec.appendChild(grid);
}

function openVideo(v) {
  const modal = byId('video-modal');
  /* enablejsapi=1 lets Pause Media (initPauseMediaControl) send a real
     pause/play command to this iframe via postMessage while it's open.
     Respect an already-paused state at open time too, rather than always
     forcing autoplay regardless of the global toggle. */
  const autoplay = isMotionPaused() ? '0' : '1';
  byId('vm-iframe').src = v.embed + (v.embed.includes('?') ? '&' : '?') + `autoplay=${autoplay}&rel=0&enablejsapi=1`;
  byId('vm-title').textContent = v.title;
  byId('vm-desc').innerHTML    = v.desc;
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}
function closeVideo() {
  const modal = byId('video-modal');
  byId('vm-iframe').src = '';     /* stop playback */
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}


/* ═════════════════════════════════════════════════════════════════════════
   ⑦b SIGN-UP FORM · name / email / affiliation → signups Google Sheet
   ─────────────────────────────────────────────────────────────────────────
   Posts to SIGNUP_ENDPOINT, an Apps Script Web App that appends one row
   per submission (see /google-apps-script/signup-sheet.gs). There are two
   copies of the same form — inline in the home page's sign-up card, and in
   #signup-modal for every other CTA — both wired by the same code here.

   When SIGNUP_ENDPOINT is still the config.js placeholder, none of this
   activates: the home card shows its old "Sign up via Google Form" button
   and the CTAs keep opening SIGN_UP_URL. That way the site is never in a
   state where the form is visible but can't submit.

   REQUEST SHAPE — Content-Type is text/plain, not application/json. That
   makes it a CORS "simple request" so the browser skips the preflight
   OPTIONS call, which Apps Script web apps can't answer. The body is still
   JSON; the script parses it with JSON.parse.
   ════════════════════════════════════════════════════════════════════════ */
function initSignUpForms() {
  const enabled = hasSignUpEndpoint();

  /* Home card: show whichever side matches our capability, drop the other
     so there's no duplicate hidden form in the accessibility tree. */
  const formSide = byId('home-signup-form-side');
  const linkSide = byId('home-signup-link-side');
  if (formSide && linkSide) {
    (enabled ? linkSide : formSide).remove();
    (enabled ? formSide : linkSide).hidden = false;
  }

  if (!enabled) return;

  [byId('home-signup-form'), byId('modal-signup-form')]
    .filter(Boolean)
    .forEach(form => form.addEventListener('submit', handleSignUpSubmit));

  /* Guarded because the browser can pair a cached index.html with a fresh
     app.js for a while after a deploy. Throwing here would abort the rest
     of init() — hero canvases, search, everything below this call — over a
     modal that simply isn't in that copy of the HTML. */
  const modal = byId('signup-modal');
  const close = byId('sm-close');
  if (!modal || !close) return;

  close.addEventListener('click', closeSignUpModal);
  modal.addEventListener('click', e => { if (e.target === modal) closeSignUpModal(); });
}

function openSignUpModal() {
  const modal = byId('signup-modal');
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  /* Focus the first field so a keyboard user lands inside the dialog
     rather than wherever the trigger left them. */
  modal.querySelector('input[name="name"]').focus();
}

function closeSignUpModal() {
  const modal = byId('signup-modal');
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

async function handleSignUpSubmit(e) {
  e.preventDefault();
  const form   = e.currentTarget;
  const status = form.querySelector('.signup-status');
  const submit = form.querySelector('button[type="submit"]');
  const field  = n => form.querySelector(`[name="${n}"]`);

  const payload = {
    name:        field('name').value.trim(),
    email:       field('email').value.trim(),
    affiliation: field('affiliation').value.trim(),
    company:     field('company').value,     /* honeypot, expected empty */
  };

  /* Validated here as well as in the script: a same-page message beats a
     round trip, and the form is novalidate so the browser won't do it. */
  if (!payload.name || !payload.email || !payload.affiliation) {
    setSignUpStatus(status, 'Please fill in all three fields.', 'error');
    return;
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(payload.email)) {
    setSignUpStatus(status, 'That email address does not look right.', 'error');
    return;
  }

  submit.disabled = true;
  setSignUpStatus(status, 'Signing you up…', '');

  try {
    const res = await fetch(SIGNUP_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow',    /* Apps Script 302s to its googleusercontent host */
    });
    const result = await res.json();

    submit.disabled = false;

    if (!result.ok) {
      setSignUpStatus(status, result.error || 'Something went wrong. Please try again.', 'error');
      return;
    }

    form.reset();
    setSignUpStatus(status, "You're on the list. Thanks!", 'ok');

  } catch {
    submit.disabled = false;
    /* Network failure, or a response we couldn't read. We can't tell
       whether the row was written, so don't claim either way. */
    setSignUpStatus(status,
      'We couldn\'t reach the sign-up service. Please try again, or email us if it keeps failing.',
      'error');
  }
}

function setSignUpStatus(el, message, kind) {
  el.textContent = message;
  el.classList.toggle('is-error', kind === 'error');
  el.classList.toggle('is-ok',    kind === 'ok');
}


/* ═════════════════════════════════════════════════════════════════════════
   ⑧ TOOLKIT PAGE — Resources tab: tabbed library + sample-report grid
   ─────────────────────────────────────────────────────────────────────────
   Renders one <button class="rt-tab"> per RESOURCE_GROUPS entry (Level 2:
   Templates / Sample Reports), and one matching <div class="rt-panel">
   per group. Switching is handled by activateResourceGroupTab(id).

   A group with more than one categoryId (Templates) renders each
   RESOURCE_CATEGORIES entry as a labeled, stacked sub-section (Level 3 —
   not a third tablist, per WAI-ARIA guidance against nested tabs) inside
   the same panel, via renderResourceCategoryBlock().

   "ready" items are rendered as a spotlight card (the first item) plus a
   divided list (the rest) — see resourceCardHTML(). "soon" items render
   with the dashed/dimmed treatment either way.
   The "reports" category has an extra .reports-grid section beneath the
   standard items (the 8 redacted sample reports) — clicking one opens the
   master-detail report browser (renderReportBrowser()) instead of
   navigating away.
   A category can have an empty items[] (e.g. "adapt", pending real
   content) — renderResourceCategoryBlock() skips the card grid (and the
   "How to use this section" aside, if bullets is also empty) rather than
   rendering an empty spotlight card.
   ════════════════════════════════════════════════════════════════════════ */
function renderToolkitResources() {
  const bar    = byId('rt-bar');
  const panels = byId('rt-panels');
  bar.innerHTML = '';
  panels.innerHTML = '';
  /*
    a11y · This is a true WAI-ARIA Tablist.
      role="tablist"   on the strip (#rt-bar gets it set below)
      role="tab"       on each button
      aria-selected    reflects active state
      aria-controls    points to the corresponding tabpanel id
      role="tabpanel"  on each panel
      aria-labelledby  on each panel points back at its tab
      ROVING TABINDEX  → only the active tab has tabindex=0; others have
                         tabindex=-1, so Tab moves PAST the strip after
                         the active tab rather than landing on every one.
      ARROW KEYS       → Left/Right cycle focus + activate (auto-select).
                         Home/End jump to first/last.
  */
  bar.setAttribute('role', 'tablist');
  bar.setAttribute('aria-label', 'Resource categories');

  RESOURCE_GROUPS.forEach((group, i) => {
    /* ── Tab button ─────────────────────────────────────────────────── */
    const tab = document.createElement('button');
    const isFirst = i === 0;
    tab.className = 'rt-tab' + (isFirst ? ' on' : '');
    tab.id = 'rt-tab-' + group.id;
    tab.dataset.tabId = group.id;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', isFirst ? 'true' : 'false');
    tab.setAttribute('aria-controls', 'rt-pan-' + group.id);
    tab.tabIndex = isFirst ? 0 : -1;   /* roving tabindex */
    tab.innerHTML = `
      <span class="rt-tab-icon">${svgIcon(group.icon)}</span>
      <span class="rt-tab-text"><span class="n">${String(i + 1).padStart(2, '0')}</span>${group.label}</span>`;
    tab.addEventListener('click',   () => activateResourceGroupTab(group.id, true));
    tab.addEventListener('keydown', e  => handleResourceGroupTabKeydown(e, i));
    bar.appendChild(tab);

    /* ── Tab panel ──────────────────────────────────────────────────── */
    const panel = document.createElement('div');
    panel.className = 'rt-panel' + (isFirst ? ' on' : '');
    panel.id = 'rt-pan-' + group.id;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', 'rt-tab-' + group.id);

    const cats = group.categoryIds.map(id => RESOURCE_CATEGORIES.find(c => c.id === id));
    panel.innerHTML = cats.map((cat, ci) =>
      renderResourceCategoryBlock(cat, cats.length > 1, ci)
    ).join('');

    panels.appendChild(panel);
    wireResourceCategoryPanel(panel);
  });

  /* The Sample Reports panel ships an empty #rt-report-browser mount, so
     fill it now from ALL_REPORTS (seeded synchronously from the static
     data). enhanceReportsWithUploads() re-renders it if the DB has rows. */
  renderReportBrowser();

  enhanceToolkitResourcesWithUploads();
  enhanceReportsWithUploads();
}

/**
 * Reads resource cards from Supabase (public, read-only, no login required —
 * enforced by the "resources are publicly readable" RLS policy), grouped by
 * `category`: one of the RESOURCE_CATEGORIES ids ('interviews' | 'panel').
 * Rows come back already shaped like a RESOURCE_CATEGORIES `items[]` entry,
 * so resourceCardHTML() renders them unchanged.
 *
 * Returns { byCategory, authoritative }:
 *   • authoritative=true  → the table is reachable AND holds at least one
 *     row, so it is the source of truth and the static arrays in data.js
 *     should be ignored entirely (that's what makes a deletion in the admin
 *     dashboard actually remove a card).
 *   • authoritative=false → Supabase is unconfigured/unreachable, or the
 *     table is still empty because /supabase/resources_admin_migration.sql
 *     hasn't been run. Callers keep rendering the static arrays so the page
 *     is never blank.
 *
 * A row's link target is link_url if set, else the public URL of its
 * uploaded file; a row with neither renders as "Coming soon".
 *
 * Cached in a module-level promise because three renderers ask for this and
 * they should share one request.
 */
let _publicResourcesPromise = null;
function getPublicResources() {
  _publicResourcesPromise ??= (async () => {
    const empty = { byCategory: {}, authoritative: false };
    if (typeof SUPABASE_URL === 'undefined' || SUPABASE_URL.includes('REPLACE-WITH') || !window.supabase) return empty;
    try {
      const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      /* Ordered client-side rather than with .order('priority') so this
         query doesn't reference a column that only exists after
         resources_admin_migration.sql has been run — a missing column makes
         PostgREST 400 the whole request, which would log a console error on
         every page load of a not-yet-migrated deployment. Row counts here
         are in the dozens, so sorting locally costs nothing. */
      const { data, error } = await sb
        .from('resources')
        .select('*')
        .order('created_at', { ascending: true });
      if (error || !data || !data.length) return empty;

      const ordered = [...data].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

      const byCategory = {};
      ordered.forEach(r => {
        const href = r.link_url
          || (r.file_path ? sb.storage.from('resource-files').getPublicUrl(r.file_path).data.publicUrl : '');
        (byCategory[r.category] ??= []).push({
          h: r.title,
          sub: r.description || '',
          icon: r.icon || 'paper',
          state: href ? 'ready' : 'soon',
          href,
        });
      });
      return { byCategory, authoritative: true };
    } catch {
      return empty;
    }
  })();
  return _publicResourcesPromise;
}

/** The cards to render for one category: the DB's rows once the table is
 *  populated, otherwise the static data.js array. See getPublicResources()
 *  for why "populated" rather than "reachable" is the switch. */
function resolveResourceItems(cat, { byCategory, authoritative }) {
  return authoritative ? (byCategory[cat.id] || []) : cat.items;
}

/** Re-renders each Toolkit category's item list (spotlight + divided list)
 *  from Supabase once the fetch resolves. Runs after the static panels are
 *  already built and visible — network-dependent content should never delay
 *  or block the initial render. */
async function enhanceToolkitResourcesWithUploads() {
  const resources = await getPublicResources();
  if (!resources.authoritative) return;
  RESOURCE_CATEGORIES.forEach(cat => {
    const mount = byId('rt-items-' + cat.id);
    if (!mount) return;   /* 'panel' has no Toolkit mount — it's on /patient */
    mount.innerHTML = resourceItemsHTML(resolveResourceItems(cat, resources));
    wireResourceCategoryPanel(mount);
  });
}

/**
 * Renders one RESOURCE_CATEGORIES entry's body: the intro block, its
 * items (or Case Studies media), and its sample-reports grid if present.
 * When `showSubheading` is true (a Level-2 group with more than one
 * category), a numbered sub-group eyebrow is prepended so the stacked
 * categories read as distinct sections rather than one merged list.
 */
function renderResourceCategoryBlock(cat, showSubheading, idx) {
  let html = showSubheading
    ? `<div class="rt-subgroup" id="rt-sub-${cat.id}">
         <p class="rt-subgroup-eyebrow">${String(idx + 1).padStart(2, '0')} · ${cat.label}</p>`
    : `<div class="rt-subgroup">`;

  /* 1) Intro block — the "How to use this section" aside is skipped
        entirely when a category has no bullets (e.g. while its items are
        pending real content). */
  html += `
    <div class="rt-intro">
      <div>
        <h2>${cat.intro.h}</h2>
        <p>${cat.intro.p}</p>
      </div>
      ${cat.intro.bullets.length ? `
      <aside>
        <h4>How to use this section</h4>
        <ul>${cat.intro.bullets.map(b => `<li>${b}</li>`).join('')}</ul>
      </aside>` : ''}
    </div>`;

  /* 2) Resource items — spotlight + divided list. The mount always exists
        (even with zero items) so enhanceToolkitResourcesWithUploads() has
        somewhere to render into once an admin uploads something for a
        category that started out empty (e.g. "adapt"). */
  html += `<div id="rt-items-${cat.id}">${resourceItemsHTML(cat.items)}</div>`;

  /* 3) Sample reports (reports category only) — ALL_REPORTS is the merged
        static + admin-published list (see enhanceReportsWithUploads()),
        already seeded synchronously from the static ones so this renders
        correctly before that fetch resolves. */
  if (cat.reports) {
    html += `
      <div style="margin-top:44px">
        <p class="eyebrow">Redacted sample reports</p>
        <h3 class="h3" style="margin-bottom:6px;font-size:22px">Real evaluations, redacted for public reference.</h3>
        <p style="font-size:13.5px;color:var(--ink-mid);max-width:640px;line-height:1.65;margin-bottom:8px">
          View HEAL-AI's ethics reports for Stanford Health Care. Each report walks through a description of
          the use case, key ethics findings and recommendations, and the places where stakeholders' values
          collide. Tool and vendor names have been anonymized.
        </p>

        <!-- Master–detail: report names on the left, the selected report's
             content on the right. Filled by renderReportBrowser(). -->
        <div class="report-browser" id="rt-report-browser"></div>
      </div>`;
  }

  return html + '</div>';   /* close .rt-subgroup */
}

/** Spotlight + divided list for one category's items — pulled out of
 *  renderResourceCategoryBlock() so enhanceToolkitResourcesWithUploads()
 *  can re-render just this piece with merged items. Empty items[] (e.g.
 *  "adapt", pending real content, or a category nothing has been
 *  uploaded to yet) renders nothing rather than an empty spotlight card. */
function resourceItemsHTML(items) {
  if (!items.length) return '';

  /* Exactly two items get equal tiles side by side. The spotlight-plus-list
     treatment below needs a list worth listing: with two items it renders
     one large tinted card above a single thin row, which reads as a layout
     mistake rather than as "featured, then the rest". One item still gets
     the spotlight (there is nothing to list, so featuring it is right), and
     three or more still get featured-plus-list. */
  if (items.length === 2) {
    return '<div class="res-pair">'
      + items.map(item => resourceCardHTML(item, 'tile')).join('')
      + '</div>';
  }

  const [first, ...rest] = items;
  let html = '<div class="res-set">' + resourceCardHTML(first, 'spotlight');
  if (rest.length) {
    html += '<div class="res-list">' + rest.map(item => resourceCardHTML(item, 'row')).join('') + '</div>';
  }
  return html + '</div>';
}

/* ═════════════════════════════════════════════════════════════════════════
   SAMPLE REPORT BROWSER
   ─────────────────────────────────────────────────────────────────────────
   Master–detail: every report's name down the left, the selected one's
   content on the right. Replaces the old tile grid + full-screen modal, so
   comparing reports no longer means opening and closing a dialog each time.

   a11y · a vertical WAI-ARIA tablist, which is what this pattern is:
     role="tablist" aria-orientation="vertical" on the list
     role="tab" + aria-selected on each name, role="tabpanel" on the detail
     ROVING TABINDEX  → only the selected name is tabbable, so Tab moves
                        past the list rather than through every report
     ARROW KEYS       → Up/Down move and select; Home/End jump to the ends

   Hovering a name also previews it, but only where the pointer can
   genuinely hover — see the pointer check in wireReportBrowser(). On
   touch, hover events are synthesised from taps and would fight the tap
   itself.
   ════════════════════════════════════════════════════════════════════════ */

/** Code of the report currently shown in the detail pane. */
let selectedReportCode = null;

function renderReportBrowser() {
  const mount = byId('rt-report-browser');
  if (!mount) return;

  if (!ALL_REPORTS.length) {
    mount.innerHTML = '<p class="rb-empty">No sample reports published yet.</p>';
    return;
  }

  /* Keep the current selection across a re-render (an admin publishing a
     report shouldn't yank the reader back to the first one), but fall back
     to the first if it's gone. */
  if (!ALL_REPORTS.some(r => r.code === selectedReportCode)) {
    selectedReportCode = ALL_REPORTS[0].code;
  }

  mount.innerHTML = `
    <div class="rb-list" role="tablist" aria-orientation="vertical" aria-label="Sample reports">
      ${ALL_REPORTS.map(r => {
        const on = r.code === selectedReportCode;
        return `
        <button class="rb-item${on ? ' on' : ''}" role="tab" id="rb-tab-${r.code}"
                data-code="${r.code}" aria-selected="${on}" aria-controls="rb-detail"
                tabindex="${on ? 0 : -1}">
          <span class="rb-item-pill">${r.code}</span>
          <span class="rb-item-text">
            <span class="rb-item-name">${r.name}</span>
            <span class="rb-item-sub">${r.sub}</span>
          </span>
        </button>`;
      }).join('')}
    </div>
    <div class="rb-detail" id="rb-detail" role="tabpanel" tabindex="0"
         aria-labelledby="rb-tab-${selectedReportCode}">
      ${reportDetailHTML(ALL_REPORTS.find(r => r.code === selectedReportCode))}
    </div>`;

  wireReportBrowser(mount);
}

/** The right-hand pane for one report, including the prev/next stepper. */
function reportDetailHTML(r) {
  if (!r) return '';
  const hasFile = r.downloadHref && r.downloadHref !== '#';
  const download = hasFile
    ? `<a class="btn-cta" href="${r.downloadHref}" target="_blank" rel="noopener">Download Full Report &rarr;</a>`
    : `<span class="btn-cta is-unavailable" aria-disabled="true">Full report coming soon</span>`;

  /* Stepper for reading straight through. Disabled at the ends rather than
     wrapping — a "Next" that jumps back to the first report is disorienting
     when the label implies forward motion. (The list's arrow keys DO wrap,
     per the ARIA tablist convention, where the roving focus makes the wrap
     obvious.) */
  const i = ALL_REPORTS.findIndex(x => x.code === r.code);
  const nav = `
    <div class="rb-nav">
      <button type="button" class="rb-nav-btn prev" data-step="-1"
              ${i <= 0 ? 'disabled' : ''} aria-label="Previous report">
        ${svgIcon('arrowR')}<span>Prev</span>
      </button>
      <span class="rb-nav-count">${r.code} / ${String(ALL_REPORTS.length).padStart(2, '0')}</span>
      <button type="button" class="rb-nav-btn next" data-step="1"
              ${i >= ALL_REPORTS.length - 1 ? 'disabled' : ''} aria-label="Next report">
        <span>Next</span>${svgIcon('arrowR')}
      </button>
    </div>`;

  return `
    <div class="rb-detail-head">
      <span class="rb-detail-pill">${r.code}</span>
      <div>
        <h4 class="rb-detail-name">${r.name}</h4>
        <p class="rb-detail-sub">${r.sub}</p>
      </div>
    </div>
    <div class="rb-section">
      <h5>Tool overview</h5>
      <p>${r.overview}</p>
    </div>
    <div class="rb-section">
      <h5>Report summary</h5>
      <p>${r.summary}</p>
    </div>
    <div class="rb-section">
      <h5>Key issues identified</h5>
      <ul>${(r.issues || []).map(i => `<li>${i}</li>`).join('')}</ul>
    </div>
    <div class="rb-actions">${download}${nav}</div>`;
}

/** Swaps the detail pane to `code` and moves the selected state. Only the
 *  pane is re-rendered, not the list, so the hovered/focused name doesn't
 *  get pulled out from under the pointer. */
function selectReport(code, { focus = false } = {}) {
  const r = ALL_REPORTS.find(x => x.code === code);
  if (!r) return;
  selectedReportCode = code;

  $$('.rb-item').forEach(btn => {
    const on = btn.dataset.code === code;
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-selected', on ? 'true' : 'false');
    btn.tabIndex = on ? 0 : -1;
    if (on && focus) btn.focus();
  });

  const pane = byId('rb-detail');
  if (pane) {
    pane.innerHTML = reportDetailHTML(r);
    pane.setAttribute('aria-labelledby', 'rb-tab-' + code);
  }
}

function wireReportBrowser(mount) {
  const items = [...mount.querySelectorAll('.rb-item')];

  /* The stepper lives inside the detail pane, which selectReport() replaces
     wholesale — so delegate from the mount, which survives that.
     Bound once: renderReportBrowser() only swaps this element's innerHTML,
     so the element itself persists across renders and a listener added
     per render would accumulate. Two handlers meant one click stepped two
     reports. (The per-item listeners below are safe — those elements are
     rebuilt each render.) */
  if (!mount.dataset.navWired) {
    mount.dataset.navWired = '1';
    mount.addEventListener('click', e => {
      const btn = e.target.closest('.rb-nav-btn');
      if (!btn || btn.disabled) return;
      const i = ALL_REPORTS.findIndex(x => x.code === selectedReportCode);
      const next = ALL_REPORTS[i + Number(btn.dataset.step)];
      if (!next) return;
      selectReport(next.code);
      /* Stepping happens from the foot of a long report, so land the reader
         at the top of the next one rather than mid-way down it. */
      const pane = byId('rb-detail');
      if (pane && pane.getBoundingClientRect().top < 0) {
        pane.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  /* Only bind hover where hovering is real. On a touchscreen the browser
     fires mouseenter off a tap, which would double-handle the click. */
  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  items.forEach((btn, i) => {
    btn.addEventListener('click', () => selectReport(btn.dataset.code));
    if (canHover) btn.addEventListener('mouseenter', () => selectReport(btn.dataset.code));

    btn.addEventListener('keydown', e => {
      let target = -1;
      switch (e.key) {
        case 'ArrowDown': target = (i + 1) % items.length;                 break;
        case 'ArrowUp':   target = (i - 1 + items.length) % items.length;  break;
        case 'Home':      target = 0;                                      break;
        case 'End':       target = items.length - 1;                       break;
        default: return;
      }
      e.preventDefault();
      selectReport(items[target].dataset.code, { focus: true });
    });
  });
}

/** Wires up a Level-2 panel's clickable cards after renderResourceCategoryBlock() HTML lands in the DOM. */
function wireResourceCategoryPanel(panel) {
  /* Wire up clickable resource cards (set by data-href) */
  panel.querySelectorAll('.res-spotlight.linked, .res-row.linked').forEach(c => {
    const href = c.dataset.href;
    const fire = () => window.open(href, '_blank', 'noopener');
    c.addEventListener('click', fire);
    c.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fire(); }
    });
  });
}

/**
 * One resource item. `variant` is 'spotlight' (large, first item in a tab)
 * or 'row' (compact, part of the divided .res-list). "ready" → live link,
 * "soon" → dimmed/dashed preview. tabIndex + role=link applied only when
 * the item is actionable so screen readers don't announce a non-link as one.
 */
function resourceCardHTML(item, variant) {
  const isLink = item.state === 'ready' && item.href;
  const wrapCls = { spotlight: 'res-spotlight', tile: 'res-tile' }[variant] || 'res-row';
  const classes = wrapCls + (isLink ? ' linked' : '') + (item.state === 'soon' ? ' soon' : '');
  const tagText = item.state === 'soon' ? '• Coming soon' : '• Available';
  const tagCls  = item.state === 'soon' ? 'res-tag soon' : 'res-tag';
  const arrow   = isLink ? `<div class="res-arrow">${svgIcon('arrowOut', {sw:2})}</div>` : '';
  const linkAttrs = isLink
    ? ` data-href="${item.href}" tabindex="0" role="link" aria-label="${stripHTML(item.h)} (opens in new tab)"`
    : '';
  return `
    <div class="${classes}"${linkAttrs}>
      <div class="res-icon">${svgIcon(item.icon)}</div>
      <div class="res-body">
        <h4>${item.h}</h4>
        <p>${item.sub}</p>
        <div class="${tagCls}">${tagText}</div>
      </div>
      ${arrow}
    </div>`;
}

/**
 * ALL_REPORTS is the merged static + admin-published sample-report list
 * (see enhanceReportsWithUploads()). Seeded synchronously from the 8
 * static reports (RESOURCE_CATEGORIES 'reports' entry + REPORT_DETAILS in
 * data.js) so the browser renders correctly before
 * the Supabase fetch resolves — same "paint fast, then upgrade" rule as
 * every other admin-editable list on the site.
 */
let ALL_REPORTS = staticReportsShaped();

/** Reshapes the static reports[]/REPORT_DETAILS pair in data.js into
 *  ALL_REPORTS' flat shape, with sequential codes ('01', '02', …). */
function staticReportsShaped() {
  const reportsCat = RESOURCE_CATEGORIES.find(c => c.reports);
  return reportsCat.reports.map((r, i) => ({
    code: String(i + 1).padStart(2, '0'),
    name: r.name, sub: r.sub, priority: null,
    ...REPORT_DETAILS[r.code],   // overview, summary, issues, downloadHref
  }));
}

/**
 * Reads admin-published reports from Supabase (public, read-only, no
 * login required — enforced by the "reports are publicly readable" RLS
 * policy in /supabase/reports_team_schema.sql) and reshapes each row to
 * ALL_REPORTS' shape. Returns [] (silently) if Supabase isn't configured
 * yet or the request fails — this is enhancement, not required content.
 */
async function getPublicReports() {
  const empty = { reports: [], authoritative: false };
  if (typeof SUPABASE_URL === 'undefined' || SUPABASE_URL.includes('REPLACE-WITH') || !window.supabase) return empty;
  try {
    const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data, error } = await sb.from('reports').select('*');
    if (error || !data || !data.length) return empty;
    return {
      authoritative: true,
      reports: data.map(r => ({
        name: r.name, sub: r.sub, priority: r.priority,
        overview: r.overview, summary: r.summary, issues: r.issues || [],
        /* '' rather than '#' — the detail pane reads an empty href as
           "no file yet" and shows an inert button instead of a link. */
        downloadHref: r.file_path ? sb.storage.from('report-files').getPublicUrl(r.file_path).data.publicUrl : '',
      })),
    };
  } catch {
    return empty;
  }
}

/** Swaps ALL_REPORTS over to the `reports` table once it holds rows, and
 *  re-renders the browser. Same rule as resources (see
 *  getPublicResources): a populated table wins outright, so deleting a
 *  report in the admin dashboard actually removes it from the site. The
 *  static arrays only show pre-migration or when Supabase is unreachable.
 *
 *  Codes are assigned by final sorted position, so they stay contiguous
 *  ('01', '02', …) no matter what was added or removed. */
async function enhanceReportsWithUploads() {
  const { reports, authoritative } = await getPublicReports();
  if (!authoritative) return;
  ALL_REPORTS = prioritySort(reports)
    .map((r, i) => ({ ...r, code: String(i + 1).padStart(2, '0') }));
  renderReportBrowser();
}


/**
 * Activate a resource tab by id.
 *
 * a11y NOTE — what this updates:
 *   • `.on` class for visual state on both tab and panel
 *   • `aria-selected` for the screen-reader announcement
 *   • `tabIndex` so only the active tab is in the Tab order (roving)
 *
 * @param {string} id       — the cat.id of the tab to activate
 * @param {boolean} focus   — when true, moves DOM focus to the new tab
 *                            (used by arrow-key handler; click leaves
 *                             focus where the user clicked).
 */
function activateResourceGroupTab(id, focus = false) {
  $$('.rt-tab').forEach(t => {
    const on = t.dataset.tabId === id;
    t.classList.toggle('on', on);
    t.setAttribute('aria-selected', on ? 'true' : 'false');
    t.tabIndex = on ? 0 : -1;
    if (on && focus) t.focus();
  });
  $$('.rt-panel').forEach(p => p.classList.toggle('on', p.id === 'rt-pan-' + id));
}

/**
 * Keyboard handler for the resource tablist.
 * Implements the WAI-ARIA Authoring Practices tab pattern:
 *   ArrowRight / ArrowLeft → cycle focus + activate (auto-select)
 *   Home / End             → jump to first / last tab
 *   Enter / Space          → fall through to the native button click
 */
function handleResourceGroupTabKeydown(e, idx) {
  const tabs = $$('.rt-tab');
  const len  = tabs.length;
  let target = -1;
  switch (e.key) {
    case 'ArrowRight': target = (idx + 1) % len;       break;
    case 'ArrowLeft':  target = (idx - 1 + len) % len; break;
    case 'Home':       target = 0;                     break;
    case 'End':        target = len - 1;               break;
    default: return;
  }
  e.preventDefault();
  activateResourceGroupTab(tabs[target].dataset.tabId, true);
}

/** Tiny HTML-stripper for aria-label values that quote item titles. */
function stripHTML(s) { return s.replace(/<[^>]+>/g, ''); }


/* ═════════════════════════════════════════════════════════════════════════
   ⑨ PATIENT PANEL renderer
   ─────────────────────────────────────────────────────────────────────────
   Left column: Stanford stats + ordered list (PP_STATS + PP_STANFORD_LIST).
   Right column: accordion of PP_EXTERNAL (first item open by default).

   a11y NOTE — the accordion
     • Header buttons toggle aria-expanded.
     • Body max-height is set inline so the CSS transition animates from 0
       to the exact measured scrollHeight (height:auto can't be animated).
   ════════════════════════════════════════════════════════════════════════ */
function renderPatientPanel() {
  /* Stats */
  byId('pp-stats').innerHTML = PP_STATS.map(s => `
    <div class="pp-stat">
      <div class="n">${s.n}</div>
      <div class="l">${s.label}</div>
    </div>
  `).join('');

  /* Stanford 4-point list */
  byId('pp-stanford-list').innerHTML = PP_STANFORD_LIST.map(item => `
    <div class="pp-list-item">
      <div class="dot" aria-hidden="true">${item.n}</div>
      <div>
        <h4>${item.h}</h4>
        <p>${item.body}</p>
      </div>
    </div>
  `).join('');

  /* External accordion */
  const acc = byId('pp-acc');
  acc.innerHTML = '';
  PP_EXTERNAL.forEach((s, i) => {
    const isOpen = i === 0;
    const item = document.createElement('div');
    item.className = 'pp-acc-item' + (isOpen ? ' open' : '');
    item.innerHTML = `
      <button class="pp-acc-head" aria-expanded="${isOpen}">
        <span class="idx">${String(i + 1).padStart(2, '0')}</span>
        <h4>${s.h}</h4>
        <span class="chev" aria-hidden="true">${svgIcon('chev', {sw:2})}</span>
      </button>
      <div class="pp-acc-body">
        <div class="pp-acc-body-inner">${s.body}</div>
      </div>`;

    const head = item.querySelector('.pp-acc-head');
    const body = item.querySelector('.pp-acc-body');
    head.addEventListener('click', () => toggleAccordionItem(item, head, body));

    acc.appendChild(item);

    /* For the open-by-default item, set inline max-height after layout */
    if (isOpen) {
      requestAnimationFrame(() => {
        body.style.maxHeight = body.querySelector('.pp-acc-body-inner').scrollHeight + 'px';
      });
    }
  });

  renderPatientResources();
}

/**
 * The 'panel' resource category, rendered at the foot of the Patient Panel
 * page rather than under Toolkit → Resources. It is deliberately NOT listed
 * in RESOURCE_GROUPS, so renderToolkitResources() never picks it up — this
 * is its only render site. Card markup is the shared resourceCardHTML()
 * treatment, so it looks identical to the Toolkit cards.
 *
 * Admin-uploaded items for category 'panel' are merged in by
 * enhancePatientResourcesWithUploads(), the same "paint static, then
 * upgrade" pattern used on the Toolkit tab.
 */
function renderPatientResources() {
  const cat = RESOURCE_CATEGORIES.find(c => c.id === 'panel');
  const mount = byId('pp-resources');
  if (!cat || !mount) return;

  byId('pp-res-h').innerHTML    = cat.intro.h;
  byId('pp-res-lede').innerHTML = cat.intro.p;

  /* Same "How to use this section" aside the Toolkit sections get. Hidden
     rather than rendered empty when a category has no bullets, matching
     renderResourceCategoryBlock()'s behaviour. */
  const aside = byId('pp-res-aside');
  if (aside) {
    const bullets = cat.intro.bullets || [];
    aside.hidden = !bullets.length;
    byId('pp-res-bullets').innerHTML = bullets.map(b => `<li>${b}</li>`).join('');
  }

  mount.innerHTML = resourceItemsHTML(cat.items);
  wireResourceCategoryPanel(mount);

  enhancePatientResourcesWithUploads();
}

/** Re-renders the Patient Panel page's 'panel' cards from Supabase once the
 *  fetch resolves. Mirrors enhanceToolkitResourcesWithUploads(), which
 *  handles the categories that render on the Toolkit tab. */
async function enhancePatientResourcesWithUploads() {
  const cat = RESOURCE_CATEGORIES.find(c => c.id === 'panel');
  const mount = byId('pp-resources');
  if (!cat || !mount) return;

  const resources = await getPublicResources();
  if (!resources.authoritative) return;
  mount.innerHTML = resourceItemsHTML(resolveResourceItems(cat, resources));
  wireResourceCategoryPanel(mount);
}

/**
 * Generic open/close for any "accordion item" on the site — shared by the
 * Patient Panel accordion (.pp-acc-*) and the Toolkit Playbook accordion
 * (.pb-acc-*) below, since both follow the identical header/body/inline-
 * max-height pattern. Looks for whichever *-body-inner wrapper is present.
 */
function toggleAccordionItem(item, head, body) {
  const open = item.classList.toggle('open');
  head.setAttribute('aria-expanded', open ? 'true' : 'false');
  const inner = body.querySelector('.pp-acc-body-inner, .pb-acc-body-inner');
  body.style.maxHeight = open ? inner.scrollHeight + 'px' : '0';
}


/* ═════════════════════════════════════════════════════════════════════════
   ⑩ TOOLKIT PAGE — Playbook tab renderer
   ─────────────────────────────────────────────────────────────────────────
   Renders PLAYBOOK_SECTIONS as an expand/reveal accordion, reusing
   toggleAccordionItem() above.
   ════════════════════════════════════════════════════════════════════════ */
function renderToolkitPlaybook() {
  const acc = byId('pb-acc');
  acc.innerHTML = '';
  PLAYBOOK_SECTIONS.forEach((s, i) => {
    const isOpen = i === 0;
    const item = document.createElement('div');
    item.className = 'pb-acc-item' + (isOpen ? ' open' : '');
    item.innerHTML = `
      <button class="pb-acc-head" aria-expanded="${isOpen}">
        <span class="idx">${s.n}</span>
        <div class="pb-acc-headtext"><h4>${s.h}</h4><p>${s.summary}</p></div>
        <span class="chev" aria-hidden="true">${svgIcon('chev', {sw:2})}</span>
      </button>
      <div class="pb-acc-body">
        <div class="pb-acc-body-inner">
          ${s.subitems.map(si => `
            <div class="pb-acc-subitem">
              <h5>${si.h}</h5>
              <p>${si.body}</p>
            </div>`).join('')}
        </div>
      </div>`;

    const head = item.querySelector('.pb-acc-head');
    const body = item.querySelector('.pb-acc-body');
    head.addEventListener('click', () => toggleAccordionItem(item, head, body));
    acc.appendChild(item);

    if (isOpen) {
      requestAnimationFrame(() => {
        body.style.maxHeight = body.querySelector('.pb-acc-body-inner').scrollHeight + 'px';
      });
    }
  });
}


/* ═════════════════════════════════════════════════════════════════════════
   ⑪ ABOUT PAGE renderers
   ════════════════════════════════════════════════════════════════════════ */
function renderAboutCards() {
  byId('about-cards').innerHTML = ABOUT_CARDS.map(c => `
    <div class="white-card">
      <h3>${c.h}</h3>
      <p>${c.p}</p>
    </div>
  `).join('');
}

/*
   YC-style card: full-bleed photo, bottom gradient, name + affiliation
   overlaid in white, role paragraph revealed on hover.

     ┌──────────────────────────┐
     │                          │
     │        [photo]           │
     │                          │
     │   ────────gradient────── │
     │   Name                   │
     │   Badge · Affiliation    │
     │   Role paragraph…        │
     └──────────────────────────┘

   The affiliation line reuses `badge` (Director / Faculty / Postdoc /
   Staff) — the closest analog to YC's "Company, Batch" sub-line without
   inventing data. Falls back to a serif-initials tile if `photo` is empty.
*/
/** Renders the given team list (team_members rows, shaped by
 *  getPublicTeamMembers() — see initTeamFeature()) into #about-team. */
function renderTeam(list) {
  byId('about-team').innerHTML = list.map(m => {
    const initials = (m.init || m.name.split(' ').map(s => s[0]).join('')).slice(0, 2);
    const media = m.photo
      ? `<img src="${m.photo}" alt="Portrait of ${m.name}" loading="lazy">`
      : `<div class="tc-fallback" aria-hidden="true">${initials}</div>`;
    /* Name renders as an external <a> when a `profile` field is set;
       falls back to a plain <span> otherwise. Only the name is the
       click target — the surrounding card is decorative. */
    const nameEl = m.profile
      ? `<a class="tc-name tc-name-link" href="${m.profile}" target="_blank" rel="noopener noreferrer">${m.name}<span class="tc-name-arrow" aria-hidden="true">↗</span></a>`
      : `<span class="tc-name">${m.name}</span>`;
    return `
      <article class="team-card">
        <div class="tc-media">${media}</div>
        <div class="tc-overlay">
          <h4 class="tc-name-wrap">${nameEl}</h4>
          <p class="tc-sub">${m.badge} · ${m.affiliation || DEFAULT_AFFILIATION}</p>
          <p class="tc-role">${m.role}</p>
        </div>
      </article>`;
  }).join('');
}

/**
 * Reads every team member from Supabase (public, read-only, no login
 * required — enforced by the "team_members are publicly readable" RLS
 * policy in /supabase/reports_team_schema.sql) and reshapes each row to
 * the flat shape renderTeam() expects. Returns [] (silently) if Supabase
 * isn't configured yet or the request fails — the team grid will simply
 * render empty in that case; there's no static fallback anymore.
 */
async function getPublicTeamMembers() {
  if (typeof SUPABASE_URL === 'undefined' || SUPABASE_URL.includes('REPLACE-WITH') || !window.supabase) return [];
  try {
    const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data, error } = await sb.from('team_members').select('*').order('created_at', { ascending: false });
    if (error || !data) return [];
    return data.map(m => ({
      name: m.name, role: m.role, badge: m.badge, priority: m.priority,
      profile: m.profile_url || '',
      /* Empty means "use DEFAULT_AFFILIATION" — see the team card markup
         in renderTeamGrid(). Only set on members who aren't at the lab's
         default institution. */
      affiliation: m.affiliation || '',
      /* `photo_url` (a plain URL/relative path — used by the original 7,
         see /supabase/team_migration.sql) wins over `photo_path` (a file
         actually uploaded to the team-photos Storage bucket via the
         admin form) when a row somehow has both. */
      photo: m.photo_url || (m.photo_path ? sb.storage.from('team-photos').getPublicUrl(m.photo_path).data.publicUrl : ''),
    }));
  } catch {
    return [];
  }
}

/**
 * team_members (Supabase) is the sole source of truth for the team grid
 * — see /supabase/team_migration.sql, which migrated the original 7
 * people in as real rows and left no static fallback in data.js by
 * request, so there's nothing to paint until this fetch resolves.
 */
async function initTeamFeature() {
  const uploaded = await getPublicTeamMembers();
  renderTeam(prioritySort(uploaded));
}

/**
 * Scrolling partner/funder logo marquee — CSS-driven, not JS-animated.
 * The track is rendered TWICE back to back; @keyframes partner-scroll
 * (style.css) translates it by exactly -50% (one copy's width) and loops,
 * so the seam between the end of copy 1 and the start of copy 2 is
 * invisible. Pausing (prefers-reduced-motion, or the site's own Pause
 * Media toggle) is handled entirely in CSS — see .motion-paused there.
 */
function renderPartnerLogos() {
  const mount = byId('about-partners');
  if (!mount) return;
  const logo = l => `<div class="partner-logo"><img src="${l.file}" alt="${l.name}" loading="eager" decoding="async"></div>`;
  const copy = PARTNER_LOGOS.map(logo).join('');
  mount.innerHTML = `<div class="partner-track">${copy}${copy}</div>`;
}


/* ═════════════════════════════════════════════════════════════════════════
   ⑫.6 NEWS — landing spotlight + 3 chronological feeds, each with its own
   full searchable directory page, merged with admin-published Supabase
   content (see /supabase/news_schema.sql and admin.html's News tab)
   ─────────────────────────────────────────────────────────────────────────
   • getPublicNewsItems()  → fetches admin-published rows, keyed by type
   • initNewsFeature()     → merges each feed's data.js array with its
                             Supabase rows, sorts, and renders the landing
                             page AND all 3 directory pages from that
   • bindNewsNav()         → "View complete directory" / "Back to News"

   Every feed (SEMINAR_VIDEOS / NEWS_ARTICLES / SCHOLARLY_PUBLICATIONS,
   data.js — plus whatever's been published in the admin dashboard) sorts
   here by `priority` first (higher shows first; admin-settable, mainly
   useful once a feed has more than 5 items and the landing page's top-5
   cut needs to be curated rather than always strictly newest-first), then
   by `date` for anything without a priority set.
   ═════════════════════════════════════════════════════════════════════════ */
function newsSorted(items) {
  return prioritySort(items, (a, b) => new Date(b.date) - new Date(a.date));
}

function newsFormatDate(iso) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function newsVideoItem(v) {
  return `
    <article class="news-item">
      <div class="news-item-date">${newsFormatDate(v.date)}</div>
      <div class="news-item-body">
        <span class="news-item-tag">Seminar</span>
        <h3 class="news-item-title"><a href="${v.link}" target="_blank" rel="noopener">${v.title}<span class="news-item-arrow" aria-hidden="true">↗</span></a></h3>
        <p class="news-item-sub">${v.speaker} · ${v.venue}</p>
        <p class="news-item-desc">${v.desc}</p>
      </div>
    </article>`;
}

function newsArticleItem(a) {
  return `
    <article class="news-item">
      <div class="news-item-date">${newsFormatDate(a.date)}</div>
      <div class="news-item-body">
        <span class="news-item-tag">Press</span>
        <h3 class="news-item-title"><a href="${a.link}" target="_blank" rel="noopener">${a.title}<span class="news-item-arrow" aria-hidden="true">↗</span></a></h3>
        <p class="news-item-sub">${a.source}</p>
        <p class="news-item-desc">${a.desc}</p>
      </div>
    </article>`;
}

function newsPublicationItem(p) {
  return `
    <article class="news-item">
      <div class="news-item-date">${newsFormatDate(p.date)}</div>
      <div class="news-item-body">
        <span class="news-item-tag">Publication</span>
        <h3 class="news-item-title"><a href="${p.link}" target="_blank" rel="noopener">${p.title}<span class="news-item-arrow" aria-hidden="true">↗</span></a></h3>
        <p class="news-item-sub">${p.authors} · ${p.journal}</p>
        <p class="news-item-desc">${p.desc}</p>
      </div>
    </article>`;
}

/** `seminarList` is already merged + sorted (newsSorted) — the featured
 *  flag (only ever set on a static data.js entry) still wins if present,
 *  otherwise the spotlight is just whatever sorted to the top, so a
 *  high-priority admin-published talk can become the spotlight too. */
function renderNewsSpotlight(seminarList) {
  const mount = byId('news-spotlight');
  if (!mount) return;
  const featured = seminarList.find(v => v.featured) || seminarList[0];
  if (!featured) { mount.innerHTML = ''; return; }
  mount.innerHTML = `
    <span class="news-spotlight-tag">Featured</span>
    <h2 class="news-spotlight-title">${featured.title}</h2>
    <p class="news-spotlight-meta">${featured.speaker} · ${featured.venue} · ${newsFormatDate(featured.date)}</p>
    <p class="news-spotlight-desc">${featured.desc}</p>
    <a class="btn-cta" href="${featured.link}" target="_blank" rel="noopener">Watch the talk <span aria-hidden="true">→</span></a>`;
}

function renderNewsList(mountId, items, template, limit) {
  const mount = byId(mountId);
  if (!mount) return;
  const list = limit ? items.slice(0, limit) : items;
  mount.innerHTML = list.length
    ? list.map(template).join('')
    : '<p class="news-empty">No entries yet — check back soon.</p>';
}

/** One full directory page: renders the given (already-sorted) feed,
 *  live-filtered by its search input. */
function renderNewsDirectory(mountId, searchId, items, template) {
  const mount = byId(mountId);
  const input = byId(searchId);
  if (!mount || !input) return;
  const apply = () => {
    const q = input.value.trim().toLowerCase();
    const filtered = q
      ? items.filter(it => Object.values(it).join(' ').toLowerCase().includes(q))
      : items;
    mount.innerHTML = filtered.length
      ? filtered.map(template).join('')
      : '<p class="news-empty">No matches. Try a different term.</p>';
  };
  input.addEventListener('input', apply);
  apply();
}

/**
 * Reads admin-published News items from Supabase (public, read-only, no
 * login required — enforced by the "news_items are publicly readable" RLS
 * policy in /supabase/news_schema.sql), keyed by `type`. Each row's `meta`
 * (speaker/venue, source, or authors/journal — whichever apply to its
 * type) is spread directly onto the returned object so it's a drop-in
 * match for a SEMINAR_VIDEOS/NEWS_ARTICLES/SCHOLARLY_PUBLICATIONS entry's
 * shape and renders with the same template functions. Returns all-empty
 * arrays (silently) if Supabase isn't configured yet or the request
 * fails — this is enhancement, not required content, same rationale as
 * getPublicResources() above.
 */
async function getPublicNewsItems() {
  const empty = { seminar_video: [], news_article: [], scholarly_publication: [] };
  if (typeof SUPABASE_URL === 'undefined' || SUPABASE_URL.includes('REPLACE-WITH') || !window.supabase) return empty;
  try {
    const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data, error } = await sb.from('news_items').select('*');
    if (error || !data) return empty;
    const byType = { seminar_video: [], news_article: [], scholarly_publication: [] };
    data.forEach(r => {
      if (!byType[r.type]) return;
      byType[r.type].push({
        date: r.date, title: r.title, desc: r.description || '', link: r.link || '#',
        priority: r.priority, ...(r.meta || {}),
      });
    });
    return byType;
  } catch {
    return empty;
  }
}

/** Fetches admin-published items once, merges each feed with its static
 *  data.js array, sorts (priority first, then date — see newsSorted()),
 *  and renders BOTH the News landing page (spotlight + top 5 per feed)
 *  and all 3 full, search-filtered directory pages from those same
 *  merged+sorted arrays. Network-dependent, so this runs after the static
 *  page is already up — same "enhancement, not blocking" rule as the
 *  Toolkit resources uploads. */
async function initNewsFeature() {
  const uploaded = await getPublicNewsItems();
  const seminar  = newsSorted([...SEMINAR_VIDEOS, ...uploaded.seminar_video]);
  const articles = newsSorted([...NEWS_ARTICLES, ...uploaded.news_article]);
  const pubs     = newsSorted([...SCHOLARLY_PUBLICATIONS, ...uploaded.scholarly_publication]);

  renderNewsSpotlight(seminar);
  renderNewsList('news-videos-list',       seminar,  newsVideoItem,       5);
  renderNewsList('news-articles-list',     articles, newsArticleItem,     5);
  renderNewsList('news-publications-list', pubs,     newsPublicationItem, 5);

  renderNewsDirectory('news-videos-full',       'news-videos-search',       seminar,  newsVideoItem);
  renderNewsDirectory('news-articles-full',     'news-articles-search',     articles, newsArticleItem);
  renderNewsDirectory('news-publications-full', 'news-publications-search', pubs,     newsPublicationItem);
}

/** "View complete directory" and "&larr; Back to News" both just carry a data-page target. */
function bindNewsNav() {
  $$('.news-viewall, .news-back').forEach(el =>
    el.addEventListener('click', () => goPage(el.dataset.page))
  );
}




/* ═════════════════════════════════════════════════════════════════════════
   ⑫.5 HUMAN-LAYER CANVAS — dense, pale, organic network behind the AI mesh
   ─────────────────────────────────────────────────────────────────────────
   The visual metaphor for "human complexity" (conversations, workflows,
   relationships) that the AI governance mesh (initHeroCanvas, below)
   distills out of. Deliberately a SEPARATE canvas and node system, not a
   second layer drawn into the AI mesh's own canvas/arrays — keeping them
   independent is what makes a future "collapse into the AI mesh" scroll
   morph tractable (interpolating between two known node sets) instead of
   trying to repurpose one system for two visually and semantically
   different jobs.

   DELIBERATELY UNDERSTATED — per spec this should read as background
   texture, not a second focal point: many more nodes than the AI mesh,
   but smaller, thinner-lined, lower-opacity, and in a paler warm blush
   tone instead of cardinal. Spans the FULL hero width (including the
   left side the AI mesh doesn't reach) via a jittered grid rather than
   the AI mesh's off-center radial clusters.

   Reuses the exact same resize/ResizeObserver/fonts.ready/watchdog
   pattern as initHeroCanvas() below — that pattern exists because of a
   real bug history on this canvas; no reason to re-risk it here.
   ════════════════════════════════════════════════════════════════════════ */
function initHumanCanvas() {
  const canvas = byId('human-canvas');
  if (!canvas || !FEATURES.heroAnimation) return;
  const ctx = canvas.getContext('2d');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  const isPaused = () => reduceMotion || isMotionPaused();
  const HUE = '196,160,148';   /* warm blush — deliberately NOT cardinal */

  let nodes = [], edges = [], pulses = [];

  function build() {
    nodes = []; pulses = [];
    const W = canvas.width, H = canvas.height;
    /* Jittered grid, not radial clusters — the point is even coverage
       across the whole canvas (especially the left side the AI mesh never
       reaches), not a centered focal shape. */
    const COLS = 12, ROWS = 8;
    const cellW = W / COLS, cellH = H / ROWS;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = c * cellW + cellW / 2 + (Math.random() - 0.5) * cellW * 0.8;
        const y = r * cellH + cellH / 2 + (Math.random() - 0.5) * cellH * 0.8;
        nodes.push({ x, y, ax: x, ay: y, r: 1 + Math.random() * 1.2, driftPhase: Math.random() * Math.PI * 2 });
      }
    }
    buildMesh();
  }

  function distSq(a, b) { const dx = a.x - b.x, dy = a.y - b.y; return dx * dx + dy * dy; }

  /* Thin k-NN mesh, k=3 (vs the AI mesh's k=4) — sparser connections read
     as "loosely networked" rather than "densely engineered." */
  function buildMesh() {
    edges = [];
    const k = 3;
    const seen = {};
    nodes.forEach((n, i) => {
      const dists = nodes
        .map((m, j) => ({ j, d: distSq(n, m) }))
        .filter(o => o.j !== i)
        .sort((a, b) => a.d - b.d)
        .slice(0, k);
      dists.forEach(o => {
        const key = i < o.j ? i + ',' + o.j : o.j + ',' + i;
        if (seen[key]) return;
        seen[key] = true;
        edges.push([i, o.j]);
      });
    });
    edges.points = nodes;
  }

  /* "Occasional flowing pulses" — deliberately rare (~0.5/sec at 60fps),
     unlike the AI mesh's more frequent packets, so it reads as ambient
     rather than active/busy. */
  function spawnPulse() {
    if (!edges.length) return;
    const e = edges[Math.floor(Math.random() * edges.length)];
    const a = edges.points[e[0]], b = edges.points[e[1]];
    if (!a || !b) return;
    pulses.push({ sx: a.x, sy: a.y, dx: b.x, dy: b.y, t: 0 });
  }

  function frame() {
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    nodes.forEach(n => {
      n.driftPhase += isPaused() ? 0 : 0.0025;
      n.x = n.ax + Math.cos(n.driftPhase) * 2.2;
      n.y = n.ay + Math.sin(n.driftPhase * 0.85) * 2.2;
    });

    const pts = edges.points;
    edges.forEach(e => {
      const a = pts[e[0]], b = pts[e[1]];
      if (!a || !b) return;
      ctx.beginPath();
      ctx.strokeStyle = `rgba(${HUE},0.24)`;
      ctx.lineWidth = 0.45;
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    });

    nodes.forEach(n => {
      ctx.beginPath();
      ctx.fillStyle = `rgba(${HUE},0.46)`;
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fill();
    });

    if (!isPaused() && Math.random() < 0.008) spawnPulse();
    pulses.forEach(p => {
      p.t += 0.012;
      const x = p.sx + (p.dx - p.sx) * p.t;
      const y = p.sy + (p.dy - p.sy) * p.t;
      ctx.beginPath();
      ctx.fillStyle = `rgba(${HUE},${Math.sin(p.t * Math.PI) * 0.5})`;
      ctx.arc(x, y, 1.6, 0, Math.PI * 2);
      ctx.fill();
    });
    pulses = pulses.filter(p => p.t < 1);

    requestAnimationFrame(frame);
  }

  function applySize(w, h) {
    if (w === canvas.width && h === canvas.height) return;
    canvas.width = w; canvas.height = h;
    build();
  }
  function resize() {
    const w = canvas.offsetWidth || window.innerWidth;
    const h = canvas.offsetHeight || window.innerHeight;
    applySize(w, h);
  }

  resize();
  if (window.ResizeObserver) {
    new ResizeObserver(entries => {
      for (const entry of entries) {
        const box = entry.contentBoxSize && entry.contentBoxSize[0];
        const w = Math.round(box ? box.inlineSize : entry.contentRect.width);
        const h = Math.round(box ? box.blockSize : entry.contentRect.height);
        if (w > 0 && h > 0) applySize(w, h);
      }
    }).observe(canvas);
  } else {
    window.addEventListener('resize', resize);
    window.addEventListener('load', resize);
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(resize);
  requestAnimationFrame(frame);

  /* Same watchdog rationale as initHeroCanvas() below — including forcing
     canvas.width to 0 first so applySize()'s "size unchanged, skip
     rebuild" guard can't no-op this, and explicitly re-arming the rAF
     loop in case it died rather than just re-measuring stale data. */
  setTimeout(() => {
    if (document.hidden) return;
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    for (let i = 3; i < data.length; i += 4) { if (data[i] !== 0) return; }
    canvas.width = 0;
    resize();
    requestAnimationFrame(frame);
  }, 1200);
}


/* ═════════════════════════════════════════════════════════════════════════
   ⑬ HERO CANVAS — cardinal polygonic mesh + 8 clickable research nodes
   ─────────────────────────────────────────────────────────────────────────
   ARCHITECTURAL NOTE
     This is a self-contained renderer wrapped in an IIFE pattern (called
     via initHeroCanvas()) to keep its many internal variables off the
     global scope. The CRITICAL externals it reads:
       • FEATURES.heroAnimation  → master on/off toggle (config.js)
       • prefers-reduced-motion  → auto-respected via matchMedia

   PALETTE — strictly cardinal + cool-grey + white. Per the brand spec,
   there is NO gold anywhere. If you change the cardinal value in style.css
   it does NOT automatically propagate here — this renderer uses literal
   rgba strings for speed. If you re-brand: search this function for
   "140,21,21" and "184,58,58" and update.

   a11y NOTE
     The canvas is aria-hidden in index.html (it's decorative). The
     research-node tooltip and click-to-open behavior are mouse-only;
     keyboard users still get full nav via the regular page links.
   ════════════════════════════════════════════════════════════════════════ */
function initHeroCanvas() {
  const canvas = byId('hero-canvas');
  if (!canvas || !FEATURES.heroAnimation) return;
  const ctx = canvas.getContext('2d');
  const tooltip = byId('node-tooltip');
  const mouse = {x: -9999, y: -9999};
  let nodes = [], triangles = [], edges = [], packets = [], hovered = null, nucleus = null;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  /* Live check (not captured once like reduceMotion) so the footer's
     Pause Media toggle can freeze/resume the mesh at any time. */
  const isPaused = () => reduceMotion || isMotionPaused();

  /* ── Layout: build all nodes around the canvas center ─────────────── */
  function build() {
    nodes = []; packets = [];
    const W = canvas.width, H = canvas.height;
    const cx = W * 0.66, cy = H * 0.42;
    nucleus = {x: cx, y: cy, r: 7, baseR: 7, isCore: true, phase: 0, ax: cx, ay: cy, driftPhase: 0};

    /* Inner ring: 8 RESEARCH nodes (clickable, blinking) */
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2 - Math.PI / 8;
      const d = 130 + Math.random() * 40;
      const br = 4.5 + Math.random() * 1.6;
      nodes.push({
        x: cx + Math.cos(ang) * d, y: cy + Math.sin(ang) * d,
        r: br, baseR: br,
        ax: cx + Math.cos(ang) * d, ay: cy + Math.sin(ang) * d,
        isRes: true, paper: null,
        blinkPhase: Math.random() * Math.PI * 2,
        blinkSpd: 0.022 + Math.random() * 0.014,
        driftPhase: Math.random() * Math.PI * 2,
      });
    }
    /* Middle ring: 8 ambient nodes */
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const d = 220 + Math.random() * 40;
      const br = 2.2 + Math.random() * 1.4;
      nodes.push({
        x: cx + Math.cos(ang) * d, y: cy + Math.sin(ang) * d,
        r: br, baseR: br,
        ax: cx + Math.cos(ang) * d, ay: cy + Math.sin(ang) * d,
        isRes: false, paper: null,
        blinkPhase: 0, blinkSpd: 0, driftPhase: Math.random() * Math.PI * 2,
      });
    }
    /* Outer ring: 14 small ambient nodes */
    for (let i = 0; i < 14; i++) {
      const ang = (i / 14) * Math.PI * 2 + (Math.random() - .5) * 0.2;
      const d = 320 + Math.random() * 120;
      const br = 1.6 + Math.random() * 1.3;
      nodes.push({
        x: cx + Math.cos(ang) * d, y: cy + Math.sin(ang) * d,
        r: br, baseR: br,
        ax: cx + Math.cos(ang) * d, ay: cy + Math.sin(ang) * d,
        isRes: false, paper: null,
        blinkPhase: 0, blinkSpd: 0, driftPhase: Math.random() * Math.PI * 2,
      });
    }
    buildMesh();
  }

  function distSq(a, b) { const dx = a.x - b.x, dy = a.y - b.y; return dx * dx + dy * dy; }

  /* Build edges (k-NN) and triangles (mutual k-NN trios) once per build */
  function buildMesh() {
    edges = []; triangles = [];
    const k = 4;
    const all = nodes.concat([nucleus]);
    const neighbors = all.map((n, i) => {
      const arr = [];
      for (let j = 0; j < all.length; j++) {
        if (j === i) continue;
        const a = {x: n.ax, y: n.ay}, b = {x: all[j].ax, y: all[j].ay};
        arr.push({idx: j, d: distSq(a, b)});
      }
      arr.sort((a, b) => a.d - b.d);
      return arr.slice(0, k).map(x => x.idx);
    });
    const seen = {};
    for (let i = 0; i < all.length; i++) {
      for (let jj = 0; jj < neighbors[i].length; jj++) {
        const j = neighbors[i][jj];
        const key = i < j ? i + ',' + j : j + ',' + i;
        if (seen[key]) continue;
        seen[key] = true;
        edges.push([i, j]);
      }
    }
    const isConn = (a, b) => !!seen[a < b ? a + ',' + b : b + ',' + a];
    const triSeen = {};
    for (let i = 0; i < all.length; i++) {
      for (let jj = 0; jj < neighbors[i].length; jj++) {
        const j = neighbors[i][jj];
        for (let kk = 0; kk < neighbors[i].length; kk++) {
          if (kk === jj) continue;
          const k2 = neighbors[i][kk];
          if (j === k2) continue;
          if (isConn(j, k2)) {
            const key = [i, j, k2].sort((a, b) => a - b).join(',');
            if (triSeen[key]) continue;
            triSeen[key] = true;
            triangles.push([i, j, k2]);
          }
        }
      }
    }
    edges.points = all;
    triangles.points = all;
  }

  function spawnPacket() {
    if (!edges.length) return;
    const e = edges[Math.floor(Math.random() * edges.length)];
    const src = edges.points[e[0]], dst = edges.points[e[1]];
    if (!src || !dst) return;
    packets.push({
      sx: src.x, sy: src.y, dx: dst.x, dy: dst.y, t: 0,
      fromRes: src.isRes || dst.isRes || src.isCore || dst.isCore,
    });
  }

  /* ── Per-frame render ─────────────────────────────────────────────── */
  function frame() {
    /* nucleus starts null and is only set inside build(); if frame() ever
       fires before the first build() completes (or after some future
       change makes that possible again), nodes.concat([nucleus]) below
       would include a null entry and n.ax on it throws — silently killing
       this rAF loop forever, which is indistinguishable from "the mesh
       never showed up." Bail and retry next frame instead of crashing. */
    if (!nucleus) { requestAnimationFrame(frame); return; }
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    /* Gentle breathing animation around each node's anchor */
    const all = nodes.concat([nucleus]);
    all.forEach(n => {
      if (!n || n.ax === undefined) return;
      n.driftPhase = (n.driftPhase || 0) + (isPaused() ? 0 : 0.004);
      n.x = n.ax + Math.cos(n.driftPhase) * 1.5;
      n.y = n.ay + Math.sin(n.driftPhase * 0.9) * 1.5;
    });

    /* Central halo */
    const hg = ctx.createRadialGradient(nucleus.x, nucleus.y, 0, nucleus.x, nucleus.y, Math.max(W, H) * 0.42);
    hg.addColorStop(0,   'rgba(255,255,255,0.55)');
    hg.addColorStop(0.2, 'rgba(184,58,58,0.10)');
    hg.addColorStop(0.5, 'rgba(140,21,21,0.04)');
    hg.addColorStop(1,   'rgba(140,21,21,0)');
    ctx.fillStyle = hg; ctx.fillRect(0, 0, W, H);

    /* Polygonal triangle "glass" faces — white→cardinal-tinted */
    const pts = triangles.points;
    triangles.forEach(tri => {
      const a = pts[tri[0]], b = pts[tri[1]], c = pts[tri[2]];
      if (!a || !b || !c) return;
      const g = ctx.createLinearGradient(
        Math.min(a.x, b.x, c.x), Math.min(a.y, b.y, c.y),
        Math.max(a.x, b.x, c.x), Math.max(a.y, b.y, c.y)
      );
      g.addColorStop(0,   'rgba(255,255,255,0.40)');
      g.addColorStop(0.6, 'rgba(184,58,58,0.05)');
      g.addColorStop(1,   'rgba(140,21,21,0.02)');
      ctx.beginPath();
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.closePath();
      ctx.fillStyle = g; ctx.fill();
    });

    /* Edges */
    const ep = edges.points;
    edges.forEach(e => {
      const a = ep[e[0]], b = ep[e[1]];
      if (!a || !b) return;
      const d = Math.sqrt(distSq(a, b));
      const alpha = Math.max(0.05, (1 - d / 440) * 0.42);
      const important = a.isRes || b.isRes || a.isCore || b.isCore;
      ctx.beginPath();
      ctx.strokeStyle = important
        ? 'rgba(140,21,21,' + (alpha * 1.3) + ')'
        : 'rgba(77,79,83,' + (alpha * 0.85) + ')';
      ctx.lineWidth = important ? 0.9 : 0.55;
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    });

    /* Travelling cardinal packets along edges */
    if (!isPaused() && Math.random() < 0.22) spawnPacket();
    for (let i = packets.length - 1; i >= 0; i--) {
      const p = packets[i];
      p.t += 0.014;
      if (p.t >= 1) { packets.splice(i, 1); continue; }
      const px = p.sx + (p.dx - p.sx) * p.t;
      const py = p.sy + (p.dy - p.sy) * p.t;
      const tail = 0.14;
      const tt = Math.max(0, p.t - tail);
      const tx = p.sx + (p.dx - p.sx) * tt;
      const ty = p.sy + (p.dy - p.sy) * tt;
      const grad = ctx.createLinearGradient(tx, ty, px, py);
      grad.addColorStop(0, 'rgba(140,21,21,0)');
      grad.addColorStop(1, p.fromRes ? 'rgba(140,21,21,1)' : 'rgba(140,21,21,0.7)');
      ctx.beginPath(); ctx.strokeStyle = grad; ctx.lineWidth = 1.7;
      ctx.moveTo(tx, ty); ctx.lineTo(px, py); ctx.stroke();
      ctx.beginPath();
      ctx.fillStyle = p.fromRes ? 'rgba(184,58,58,1)' : 'rgba(140,21,21,0.85)';
      ctx.shadowColor = 'rgba(140,21,21,0.8)'; ctx.shadowBlur = 10;
      ctx.arc(px, py, 2, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    }

    /* Ambient nodes — cool grey */
    nodes.forEach(n => {
      if (n.isRes) return;
      const dx = mouse.x - n.x, dy = mouse.y - n.y;
      const prox = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) / 180);
      ctx.beginPath(); ctx.fillStyle = 'rgba(77,79,83,' + (0.14 + prox * 0.28) + ')';
      ctx.arc(n.x, n.y, n.r * 2.1, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.fillStyle = 'rgba(77,79,83,' + (0.62 + prox * 0.32) + ')';
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.fill();
    });

    /*
       Central nucleus — pure cardinal, styled identically to the
       research nodes so every "lit" bubble in the mesh reads the same.
       No white core, no center dot. Just a soft cardinal halo + a solid
       cardinal disc with the shared drop-shadow glow.
    */
    nucleus.phase += isPaused() ? 0 : 0.018;
    const coreBlink = 0.85 + 0.15 * Math.sin(nucleus.phase);
    /* Halo alpha values here (and on the research nodes below) were tuned
       DOWN to give a more subtle glow — solid bubble stays crisp but the
       red bleed around it is much softer. Bump these back up if you ever
       want a more dramatic halo. */
    const hg2 = ctx.createRadialGradient(nucleus.x, nucleus.y, 0, nucleus.x, nucleus.y, nucleus.baseR * 7);
    hg2.addColorStop(0,    'rgba(184,58,58,' + (0.28 * coreBlink) + ')');
    hg2.addColorStop(0.5,  'rgba(140,21,21,' + (0.12 * coreBlink) + ')');
    hg2.addColorStop(1,    'rgba(140,21,21,0)');
    ctx.beginPath(); ctx.fillStyle = hg2;
    ctx.arc(nucleus.x, nucleus.y, nucleus.baseR * 7, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath();
    ctx.fillStyle = 'rgba(140,21,21,' + (0.92 + 0.08 * coreBlink) + ')';
    ctx.shadowColor = 'rgba(140,21,21,0.55)'; ctx.shadowBlur = 12;
    ctx.arc(nucleus.x, nucleus.y, nucleus.baseR, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    /*
       Research nodes — pure cardinal, same treatment as the nucleus.
       (Previously each had a white highlight offset up-left; removed so
        every lit bubble on the canvas is a uniform red glow.)
    */
    nodes.forEach(n => {
      if (!n.isRes) return;
      n.blinkPhase += n.blinkSpd * (isPaused() ? 0 : 1);
      const blink = 0.55 + 0.45 * Math.sin(n.blinkPhase);
      const rr = n.baseR * (1 + 0.14 * Math.sin(n.blinkPhase));
      const hg3 = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, rr * 4);
      hg3.addColorStop(0,    'rgba(184,58,58,' + (0.24 * blink) + ')');
      hg3.addColorStop(0.5,  'rgba(140,21,21,' + (0.12 * blink) + ')');
      hg3.addColorStop(1,    'rgba(140,21,21,0)');
      ctx.beginPath(); ctx.fillStyle = hg3;
      ctx.arc(n.x, n.y, rr * 4, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.fillStyle = 'rgba(140,21,21,' + (0.92 + 0.08 * blink) + ')';
      ctx.shadowColor = 'rgba(140,21,21,0.55)'; ctx.shadowBlur = 8;
      ctx.arc(n.x, n.y, rr, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    });

    /* Hover/click interactivity intentionally disabled — the mesh is
       decorative artwork, not a link surface. See the mouse-wiring block
       below for the neutered event listeners. */
    requestAnimationFrame(frame);
  }

  /* ── Resize handling ──────────────────────────────────────────────── */
  /*
     IMPORTANT: canvas.offsetWidth can read as 0 (or a stale value) at the
     moment defer-loaded scripts run — a layout-timing quirk that gets worse
     once font swaps / late layout shifts happen after the first measurement.
     A one-off window 'load' re-check isn't reliable enough: it can still
     fire before the box settles, permanently freezing the backing buffer at
     the wrong size while offsetWidth/offsetHeight report the true size.

     Fix: use a ResizeObserver on the canvas itself, so the backing buffer
     is re-measured every time its actual rendered box changes, for any
     reason (window resize, font load, layout shift) — not just the two
     events we happened to think of.
  */
  function applySize(w, h) {
    if (w === canvas.width && h === canvas.height) return;
    canvas.width  = w;
    canvas.height = h;
    build();
  }

  function resize() {
    const w = canvas.offsetWidth  || window.innerWidth;
    const h = canvas.offsetHeight || window.innerHeight;
    applySize(w, h);
  }

  /* ── Mouse wiring ─────────────────────────────────────────────────── */
  /*
     The mesh used to be interactive: hovering a research node lit up a
     tooltip and clicking opened the associated news / journal URL. That
     behavior is intentionally REMOVED — the hero mesh is now purely
     decorative artwork. The tooltip element and PAPERS data array are
     left in data.js/index.html untouched in case we want to re-enable
     this later; nothing in this file references them anymore.

     Only mousemove is kept, and it just tracks the cursor so the ambient
     (grey) outer-ring nodes still get their subtle proximity brighten.
  */
  canvas.addEventListener('mousemove', e => {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
  });
  canvas.addEventListener('mouseleave', () => {
    mouse.x = -9999; mouse.y = -9999;
  });

  resize();
  if (window.ResizeObserver) {
    new ResizeObserver(entries => {
      for (const entry of entries) {
        const box = entry.contentBoxSize && entry.contentBoxSize[0];
        const w = Math.round(box ? box.inlineSize : entry.contentRect.width);
        const h = Math.round(box ? box.blockSize  : entry.contentRect.height);
        if (w > 0 && h > 0) applySize(w, h);
      }
    }).observe(canvas);
  } else {
    window.addEventListener('resize', resize);
    window.addEventListener('load', resize);
  }
  /* On a cold cache (a visitor's genuine first load), the Google Fonts
     <link> in index.html hasn't downloaded yet, so text first renders in
     a fallback font, then swaps to the real one once it arrives — the
     exact "layout shifts after fonts load" class of bug the resize
     comment above already worries about. document.fonts.ready is the
     standards-based signal for "every font actually finished loading,"
     more precise than window.load, so force one more measurement then. */
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(resize);
  }
  requestAnimationFrame(frame);

  /* Watchdog: verify the mesh actually painted something ~1.2s after init,
     and force a full rebuild + re-armed draw loop if not. This is a
     deliberate belt-and-suspenders check — every failure mode we've found
     so far (a crash before requestAnimationFrame was ever reached, a
     stale zero-size backing buffer, nucleus being null mid-frame) is
     already fixed above, but this catches ANY other way the canvas could
     end up empty on first load, known or not, at the cost of one
     getImageData call that only ever runs once. Forcing canvas.width to 0
     first defeats applySize()'s "size unchanged, skip rebuild" guard —
     otherwise a watchdog re-check at the SAME size as before would no-op
     instead of actually rebuilding. requestAnimationFrame(frame) is
     called explicitly too, in case the original loop died rather than
     the canvas just being sized wrong. */
  setTimeout(() => {
    if (document.hidden) return;   /* backgrounded tab throttles rAF — not a bug */
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] !== 0) return;   /* found a painted pixel — mesh is fine */
    }
    canvas.width = 0;
    resize();
    requestAnimationFrame(frame);
  }, 1200);
}


/* ═════════════════════════════════════════════════════════════════════════
   ⑬ GLOBAL EVENT WIRING
   ─────────────────────────────────────────────────────────────────────────
   Document-level listeners that aren't owned by a specific renderer:
     • Escape   → close the video modal first, then the mobile menu.
     • Click backdrop of #video-modal → close modal.
     • Close-button on the modal → close modal.
   ════════════════════════════════════════════════════════════════════════ */
function bindGlobalEvents() {
  const modal = byId('video-modal');
  modal.addEventListener('click', e => {
    if (e.target === modal) closeVideo();
  });
  byId('vm-close').addEventListener('click', closeVideo);

  const signupModal = byId('signup-modal');

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (modal.classList.contains('open'))       { closeVideo(); return; }
    /* Optional chaining for the same cached-HTML reason as
       initSignUpForms() — an Escape press shouldn't throw and swallow the
       mobile-menu close below it. */
    if (signupModal?.classList.contains('open')) { closeSignUpModal(); return; }
    if (mobileOpen) { closeMobileMenu(); return; }
  });
}


/* ═════════════════════════════════════════════════════════════════════════
   ⑭ PAUSE MEDIA — footer-global's site-wide reduced-motion toggle
   ─────────────────────────────────────────────────────────────────────────
   Persists across navigation/reloads via localStorage. isMotionPaused()
   (② TINY HELPERS) is what the hero canvas actually checks each frame;
   this function only owns the button + the body class it reads from.
   ════════════════════════════════════════════════════════════════════════ */
function initPauseMediaControl() {
  /* Both footers expose the same control (footer-global's light-theme
     .fg-pause and footer-home's dark-theme .foot-pause) — one shared
     motion-paused state, kept in sync across whichever button exists. */
  const controls = [
    { btn: byId('fg-pause-btn'),   label: byId('fg-pause-label') },
    { btn: byId('home-pause-btn'), label: byId('home-pause-label') },
  ].filter(c => c.btn);
  if (!controls.length) return;

  const applyState = paused => {
    document.body.classList.toggle('motion-paused', paused);
    controls.forEach(({ btn, label }) => {
      btn.setAttribute('aria-pressed', String(paused));
      label.textContent = paused ? 'Play Media' : 'Pause Media';
    });
    setEmbeddedMediaState(paused);
  };

  applyState(localStorage.getItem('heal-ai-motion-paused') === '1');

  controls.forEach(({ btn }) => btn.addEventListener('click', () => {
    const next = !document.body.classList.contains('motion-paused');
    localStorage.setItem('heal-ai-motion-paused', next ? '1' : '0');
    applyState(next);
  }));
}

/**
 * Extends Pause Media beyond the hero canvas to actual video: sends the
 * YouTube iframe postMessage API's pause/play command to the training-video
 * modal's iframe if one is currently loaded. Requires enablejsapi=1 on the
 * iframe's src (set where it's created: openVideo()). No-ops safely if
 * nothing is loaded yet — there's nothing to pause.
 */
function setEmbeddedMediaState(paused) {
  const msg = JSON.stringify({ event: 'command', func: paused ? 'pauseVideo' : 'playVideo', args: [] });
  $$('.vm-frame iframe').forEach(f => {
    if (f.src) f.contentWindow.postMessage(msg, '*');
  });
}


/* ═════════════════════════════════════════════════════════════════════════
   ⑮ SITE SEARCH — footer-global's "search across everything"
   ─────────────────────────────────────────────────────────────────────────
   buildSearchIndex() walks the same content arrays every other renderer
   reads from data.js, so the index can never drift out of sync with what's
   actually on the page — there's no separate copy of the content to keep
   updated. Matching is a simple case-insensitive substring check against
   title + subtitle + keywords; good enough for a site this size without
   pulling in a search library.
   ════════════════════════════════════════════════════════════════════════ */
function buildSearchIndex() {
  const index = [];
  const add = (title, sub, pageId, extra = {}) => {
    if (!title) return;
    index.push({ title: stripHTML(title), sub: stripHTML(sub || ''), pageId, ...extra });
  };

  NAV_ITEMS.forEach(n => add(n.label, '', n.id));

  /* The 'panel' category lives on the Patient Panel page, not in any
     RESOURCE_GROUPS tab, so index its items against that page instead. */
  (RESOURCE_CATEGORIES.find(c => c.id === 'panel')?.items || [])
    .forEach(item => add(item.h, item.sub, 'patient'));

  RESOURCE_GROUPS.forEach(group => {
    group.categoryIds.forEach(catId => {
      const cat = RESOURCE_CATEGORIES.find(c => c.id === catId);
      if (cat.items) {
        cat.items.forEach(item => add(item.h, item.sub, 'toolkit', { tkTab: 'resources', groupId: group.id }));
      }
      if (cat.reports) {
        cat.reports.forEach(r => add(r.name, r.sub, 'toolkit', { tkTab: 'resources', groupId: group.id, reportCode: r.code }));
      }
    });
  });

  FURM_STEPS.forEach(s => add(s.title, s.desc, 'toolkit', { tkTab: 'process' }));
  GET_STARTED_STEPS.forEach(s => add(s.title, s.desc, 'home'));
  PLAYBOOK_SECTIONS.forEach(sec => {
    add(sec.h, sec.summary, 'toolkit', { tkTab: 'playbook' });
    sec.subitems.forEach(si => add(si.h, si.body, 'toolkit', { tkTab: 'playbook' }));
  });
  ABOUT_CARDS.forEach(c => add(c.h, c.p, 'about'));
  PP_STANFORD_LIST.forEach(i => add(i.h, i.body, 'patient'));
  PP_EXTERNAL.forEach(i => add(i.h, i.body, 'patient'));
  if (SHOW_VIDEOS) VIDEOS.forEach(v => add(v.title, v.desc, 'videos'));

  return index;
}

function initSiteSearch() {
  const input   = byId('fg-search-input');
  const results = byId('fg-search-results');
  if (!input) return;

  const index = buildSearchIndex();
  let activeIdx = -1;
  let matches = [];

  const close = () => {
    results.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    activeIdx = -1;
  };

  const render = () => {
    if (!matches.length) {
      results.innerHTML = '<div class="fg-result-empty">No matches. Try a different term.</div>';
      results.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      return;
    }
    results.innerHTML = matches.map((m, i) => `
      <div class="fg-result${i === activeIdx ? ' active' : ''}" role="option" data-idx="${i}">
        <div><span class="fg-result-title">${m.title}</span><span class="fg-result-meta">${m.pageId}</span></div>
        ${m.sub ? `<div class="fg-result-sub">${m.sub}</div>` : ''}
      </div>`).join('');
    results.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  };

  const go = m => {
    goPage(m.pageId);
    if (m.tkTab) activateToolkitTab(m.tkTab, false);
    if (m.tkTab === 'resources' && m.groupId) activateResourceGroupTab(m.groupId, false);
    if (m.reportCode) selectReport(m.reportCode);
    input.value = '';
    close();
  };

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    if (!q) { close(); return; }
    matches = index
      .filter(e => (e.title + ' ' + e.sub).toLowerCase().includes(q))
      .slice(0, 8);
    activeIdx = -1;
    render();
  });

  input.addEventListener('keydown', e => {
    if (results.hidden) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); activeIdx = Math.min(activeIdx + 1, matches.length - 1); render(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); activeIdx = Math.max(activeIdx - 1, 0); render(); }
    else if (e.key === 'Enter') { e.preventDefault(); if (matches[activeIdx]) go(matches[activeIdx]); else if (matches[0]) go(matches[0]); }
    else if (e.key === 'Escape') { close(); }
  });

  results.addEventListener('click', e => {
    const row = e.target.closest('.fg-result');
    if (row) go(matches[Number(row.dataset.idx)]);
  });

  document.addEventListener('click', e => {
    if (!results.hidden && !e.target.closest('.fg-search')) close();
  });
}


/* ═════════════════════════════════════════════════════════════════════════
   ⑯ INIT — run every renderer once, then start the canvas loop
   ════════════════════════════════════════════════════════════════════════ */
function init() {
  bootLoader();

  /* Routing + nav first so sign-up URLs are wired before any user click */
  renderNav();
  bindMobileToggle();

  /* Deep-link / reload support: land on whatever page the URL hash names
     instead of always resetting to Home. No history entry is pushed here —
     the browser already owns whatever entry brought us to this URL. */
  const initialPage = location.hash.slice(1);
  if (initialPage) setActivePage(initialPage);
  updateFooterVisibility(currentPage);   /* setActivePage() no-ops on the default (no-hash) load */

  /* Page-specific renderers */
  renderHero();
  renderHomeAbout();
  renderStats();
  renderGetStarted();
  renderToolkitTabs();
  renderProcessSteps();
  renderVideos();
  renderToolkitResources();
  renderPatientPanel();
  renderToolkitPlaybook();
  renderAboutCards();
  initTeamFeature();
  renderPartnerLogos();
  initNewsFeature();

  /* Document-level wiring */
  bindGlobalEvents();
  bindNewsNav();
  initSignUpForms();
  initPauseMediaControl();
  initSiteSearch();

  /* Hero canvases last — least critical, can run after content is painted.
     Human layer first so it's already built by the time the AI mesh (which
     visually sits on top of it) starts drawing, though neither actually
     depends on the other's init order.

     Each gets its own try/catch: these are now three independent systems
     (two canvases + the scroll-intro wiring) sharing one init() call, and
     a synchronous throw in any one of them would otherwise abort every
     call after it in this function — exactly the failure mode that once
     made the AI mesh silently never appear at all. An error here logs to
     the console instead of taking the other two down with it. */
  try { initHumanCanvas(); }    catch (e) { console.error('initHumanCanvas failed:', e); }
  try { initHeroCanvas(); }     catch (e) { console.error('initHeroCanvas failed:', e); }
  try { initHeroScrollIntro(); } catch (e) { console.error('initHeroScrollIntro failed:', e); }
}

/* defer-loaded so the DOM is ready by the time this executes. */
init();
