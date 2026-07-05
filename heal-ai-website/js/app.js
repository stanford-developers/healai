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
 * Open SIGN_UP_URL in a new tab. Single helper so the URL only lives in
 * config.js — there are no string copies of it floating around.
 */
function openSignUp() { window.open(SIGN_UP_URL, '_blank', 'noopener'); }


/* ═════════════════════════════════════════════════════════════════════════
   ③ LOADER
   ─────────────────────────────────────────────────────────────────────────
   Letter-by-letter brand fade-in, then a line slide + sub fade. The
   element is then dismissed by class toggle. Honors FEATURES.showLoader.
   ════════════════════════════════════════════════════════════════════════ */
function bootLoader() {
  const loader = byId('loader');
  if (!FEATURES.showLoader) { loader.remove(); return; }

  const hl = byId('loader-hl');
  /* Build the headline letter-by-letter so each can animate independently */
  BRAND.split('').forEach(ch => {
    const s = document.createElement('span');
    if (ch === ' ') { s.className = 'sp'; s.innerHTML = '&nbsp;'; }
    else { s.textContent = ch; }
    hl.appendChild(s);
  });
  byId('loader-sub').textContent = BRAND_SUBTITLE;

  /* Cascade fade-in */
  hl.querySelectorAll('span:not(.sp)').forEach((s, i) =>
    setTimeout(() => s.classList.add('in'), 90 + i * TIMINGS.loaderLetterMs)
  );
  setTimeout(() => byId('loader-line').classList.add('in'), 520);
  setTimeout(() => byId('loader-sub').classList.add('in'),  720);

  /* Dismiss */
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

  /* Wire every Sign-up CTA on the site to SIGN_UP_URL */
  ['nav-signup-btn', 'home-signup-btn', 'playbook-signup-btn', 'footer-signup', 'footer-global-signup']
    .forEach(id => {
      const el = byId(id);
      if (!el) return;
      el.href = SIGN_UP_URL;
      el.target = '_blank';
      el.rel = 'noopener';
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
  byId('hero-eyebrow').textContent = HERO_COPY.eyebrow;
  byId('home-hero-h').innerHTML    = HERO_COPY.headline;
  byId('hero-sub').textContent     = HERO_COPY.sub;

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

function routeAction(action) {
  if (!action) return;
  if (action.startsWith('page:')) goPage(action.slice(5));
  else if (action === 'url')      openSignUp();
}

/** Positioning statement + 3 pillar cards. */
function renderHomeAbout() {
  byId('about-h').innerHTML = HOME_ABOUT.statement;
  const side = byId('about-bullets');
  side.innerHTML = HOME_ABOUT.bullets.map(b => `
    <div class="about-bullet">
      <div class="about-bullet-icon" aria-hidden="true">${b.letter}</div>
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
   ⑥ PROCESS PAGE renderer (FURM 4-step grid)
   ════════════════════════════════════════════════════════════════════════ */
function renderProcessSteps() {
  const wrap = byId('process-steps');
  wrap.innerHTML = '';
  FURM_STEPS.forEach(s => {
    /* Build a 4-dot visual gauge with the first `gates` dots highlighted */
    const dots = Array.from({length: 4}, (_, i) =>
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
        <p>A six-part series — FURM, the four-step process, stakeholder interviews,
        the patient panel, writing the EOP, and adapting the process — is in
        production. Sign up for updates and we'll let you know the moment it goes live.</p>
        <div style="margin-top:24px">
          <a href="${SIGN_UP_URL}" target="_blank" rel="noopener" class="btn-prime">Notify me →</a>
        </div>
      </div>`;
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

    /* Resource chips route to the Resources page */
    card.querySelectorAll('.vr-chip').forEach(chip => {
      chip.addEventListener('click', e => { e.stopPropagation(); goPage('resources'); });
    });

    grid.appendChild(card);
  });
  sec.appendChild(grid);
}

function openVideo(v) {
  const modal = byId('video-modal');
  byId('vm-iframe').src = v.embed + (v.embed.includes('?') ? '&' : '?') + 'autoplay=1&rel=0';
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
   ⑧ RESOURCES PAGE — tabbed library + sample-report grid
   ─────────────────────────────────────────────────────────────────────────
   Renders one <button class="rt-tab"> per RESOURCE_CATEGORIES entry, and
   one matching <div class="rt-panel"> per entry. Switching is handled by
   activateResourceTab(id).

   "ready" items are rendered as a spotlight card (the first item) plus a
   divided list (the rest) — see resourceCardHTML(). "soon" items render
   with the dashed/dimmed treatment either way.
   The "reports" category has an extra .reports-grid section beneath the
   standard items (the 8 redacted sample reports) — clicking one opens the
   in-site report-detail modal (openReportDetail()) instead of navigating
   away.
   The "cases" category has no items[] at all — it uses cat.media instead,
   rendered by renderCaseStudiesMedia() (featured lazy-autoplay embed +
   talk cards + embed grid).
   ════════════════════════════════════════════════════════════════════════ */
function renderResources() {
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

  RESOURCE_CATEGORIES.forEach((cat, i) => {
    /* ── Tab button ─────────────────────────────────────────────────── */
    const tab = document.createElement('button');
    const isFirst = i === 0;
    tab.className = 'rt-tab' + (isFirst ? ' on' : '');
    tab.id = 'rt-tab-' + cat.id;
    tab.dataset.tabId = cat.id;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', isFirst ? 'true' : 'false');
    tab.setAttribute('aria-controls', 'rt-pan-' + cat.id);
    tab.tabIndex = isFirst ? 0 : -1;   /* roving tabindex */
    tab.innerHTML = `<span class="n">${String(i + 1).padStart(2, '0')}</span>${cat.label}`;
    tab.addEventListener('click',   () => activateResourceTab(cat.id, true));
    tab.addEventListener('keydown', e  => handleTabKeydown(e, i));
    bar.appendChild(tab);

    /* ── Tab panel ──────────────────────────────────────────────────── */
    const panel = document.createElement('div');
    panel.className = 'rt-panel' + (i === 0 ? ' on' : '');
    panel.id = 'rt-pan-' + cat.id;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', 'rt-tab-' + cat.id);

    /* 1) Intro block */
    let html = `
      <div class="rt-intro">
        <div>
          <h2>${cat.intro.h}</h2>
          <p>${cat.intro.p}</p>
        </div>
        <aside>
          <h4>How to use this section</h4>
          <ul>${cat.intro.bullets.map(b => `<li>${b}</li>`).join('')}</ul>
        </aside>
      </div>`;

    /* 2) Resource items — either the standard spotlight+list, or (cases
          tab only) the featured-embed media layout. */
    if (cat.media) {
      html += renderCaseStudiesMedia(cat.media);
    } else {
      const [first, ...rest] = cat.items;
      html += '<div class="res-set">' + resourceCardHTML(first, 'spotlight');
      if (rest.length) {
        html += '<div class="res-list">' + rest.map(item => resourceCardHTML(item, 'row')).join('') + '</div>';
      }
      html += '</div>';
    }

    /* 3) Sample reports (reports category only) */
    if (cat.reports) {
      html += `
        <div style="margin-top:44px">
          <p class="eyebrow">Eight redacted sample reports</p>
          <h3 class="h3" style="margin-bottom:6px;font-size:22px">Real evaluations, redacted for public reference.</h3>
          <p style="font-size:13.5px;color:var(--ink-mid);max-width:640px;line-height:1.65;margin-bottom:8px">
            Each report walks through intake, stakeholder findings, expert vetting, and the final recommendation.
            Tool names and vendor specifics are redacted.
          </p>
          <div class="reports-grid">
            ${cat.reports.map(r => `
              <div class="report-row" data-code="${r.code}" tabindex="0"
                   role="button" aria-label="Open sample report: ${stripHTML(r.name)}">
                <span class="report-pill">${r.code}</span>
                <div><h5>${r.name}</h5><span>${r.sub}</span></div>
                ${svgIcon('arrowOut', {sw:2, stroke:'var(--ink-low)'})}
              </div>`).join('')}
          </div>
        </div>`;
    }

    panel.innerHTML = html;
    panels.appendChild(panel);

    /* Wire up clickable resource cards + talk cards (set by data-href) */
    panel.querySelectorAll('.res-spotlight.linked, .res-row.linked, .cs-talk-card').forEach(c => {
      const href = c.dataset.href;
      const fire = () => window.open(href, '_blank', 'noopener');
      c.addEventListener('click', fire);
      c.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fire(); }
      });
    });
    /* Sample-report row → opens the in-site detail modal, not an external tab */
    panel.querySelectorAll('.report-row').forEach(row => {
      const fire = () => openReportDetail(row.dataset.code);
      row.addEventListener('click', fire);
      row.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fire(); }
      });
    });
    /* Case-studies embeds: click-to-play now, or lazy-autoplay on scroll */
    if (cat.media) initLazyVideoEmbeds(panel);
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
  const wrapCls = variant === 'spotlight' ? 'res-spotlight' : 'res-row';
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
 * "Case Studies & Talks" tab body: a featured video + 2 talk cards up top,
 * then a grid of the remaining case-study clips. See CASE STUDIES CSS
 * comment for why talks are plain links but embeds are lazy-autoplay.
 */
function renderCaseStudiesMedia(media) {
  return `
    <div class="cs-featured-row">
      <div class="cs-talks">
        ${media.talks.map(t => `
          <div class="cs-talk-card" data-href="${t.href}" tabindex="0"
               role="link" aria-label="${stripHTML(t.h)} (opens in new tab)">
            <div class="cs-talk-play"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div>
            <div><h4>${t.h}</h4><p>${t.sub}</p></div>
          </div>`).join('')}
      </div>
      ${csEmbedHTML(media.featured)}
    </div>
    <div class="cs-grid">
      ${media.grid.map(g => csEmbedHTML(g)).join('')}
    </div>`;
}

/** One lazy-autoplay video embed cell — starts as a YouTube-thumbnail
 *  poster and swaps in a live iframe via initLazyVideoEmbeds() below. */
function csEmbedHTML(v) {
  const thumb = `https://img.youtube.com/vi/${v.youtubeId}/hqdefault.jpg`;
  return `
    <div class="cs-embed" data-yt-id="${v.youtubeId}" style="background-image:url('${thumb}')"
         role="button" tabindex="0" aria-label="Play: ${stripHTML(v.title)}">
      <div class="cs-embed-play"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div>
      <div class="cs-embed-meta"><h4>${v.title}</h4><p>${v.desc}</p></div>
    </div>`;
}

/**
 * Wires up every `.cs-embed` inside `root`: clicking/pressing Enter plays
 * it immediately; scrolling one into view (50% visible) auto-plays it too,
 * muted, via YouTube's iframe autoplay param (the one platform of the two
 * used on this tab that actually supports autoplay — see the CSS comment
 * above .cs-embed for why Drive-hosted talks don't get this treatment).
 * Each embed only loads its iframe once (`dataset.playing` guards re-entry).
 */
function initLazyVideoEmbeds(root) {
  const playEmbed = el => {
    if (el.dataset.playing) return;
    el.dataset.playing = '1';
    const id = el.dataset.ytId;
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}&rel=0`;
    iframe.title = el.getAttribute('aria-label') || 'Video';
    iframe.allow = 'autoplay; encrypted-media; picture-in-picture';
    iframe.setAttribute('allowfullscreen', '');
    el.appendChild(iframe);
    el.classList.add('playing');
  };

  const embeds = root.querySelectorAll('.cs-embed');
  embeds.forEach(el => {
    el.addEventListener('click', () => playEmbed(el));
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); playEmbed(el); }
    });
  });

  if (!('IntersectionObserver' in window)) return;   /* click-to-play still works */
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => { if (entry.isIntersecting) playEmbed(entry.target); });
  }, { threshold: 0.5 });
  embeds.forEach(el => observer.observe(el));
}

/**
 * Opens the in-site "hidden pane" for a sample report — real content
 * migrated from that report's page on heal-ai.stanford.edu (REPORT_DETAILS
 * in data.js) instead of redirecting the visitor off-site. The external
 * .docx link is preserved as the modal's "Download Full Report" action.
 */
function openReportDetail(code) {
  const reportsCat = RESOURCE_CATEGORIES.find(c => c.reports);
  const meta   = reportsCat && reportsCat.reports.find(r => r.code === code);
  const detail = REPORT_DETAILS[code];
  if (!meta || !detail) return;

  byId('rm-pill').textContent     = code;
  byId('rm-title').textContent    = stripHTML(meta.name);
  byId('rm-overview').textContent = detail.overview;
  byId('rm-summary').textContent  = detail.summary;
  byId('rm-issues').innerHTML     = detail.issues.map(i => `<li>${i}</li>`).join('');
  byId('rm-download').href        = detail.downloadHref;

  const modal = byId('report-modal');
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}
function closeReportModal() {
  const modal = byId('report-modal');
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
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
function activateResourceTab(id, focus = false) {
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
function handleTabKeydown(e, idx) {
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
  activateResourceTab(tabs[target].dataset.tabId, true);
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
    head.addEventListener('click', () => togglePatientAcc(item, head, body));

    acc.appendChild(item);

    /* For the open-by-default item, set inline max-height after layout */
    if (isOpen) {
      requestAnimationFrame(() => {
        body.style.maxHeight = body.querySelector('.pp-acc-body-inner').scrollHeight + 'px';
      });
    }
  });
}

function togglePatientAcc(item, head, body) {
  const open = item.classList.toggle('open');
  head.setAttribute('aria-expanded', open ? 'true' : 'false');
  body.style.maxHeight = open
    ? body.querySelector('.pp-acc-body-inner').scrollHeight + 'px'
    : '0';
}


/* ═════════════════════════════════════════════════════════════════════════
   ⑩ PLAYBOOK PAGE renderer
   ════════════════════════════════════════════════════════════════════════ */
function renderPlaybook() {
  byId('playbook-grid').innerHTML = PLAYBOOK_CARDS.map(c => `
    <div class="pb-card">
      <div class="icon">${svgIcon(c.icon)}</div>
      <h4>${c.h}</h4>
      <p>${c.desc}</p>
      <span class="badge">${c.state === 'soon' ? 'Coming soon' : 'Available'}</span>
    </div>
  `).join('');
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
function renderTeam() {
  byId('about-team').innerHTML = TEAM.map(m => {
    const initials = (m.init || m.name.split(' ').map(s => s[0]).join('')).slice(0, 2);
    const media = m.photo
      ? `<img src="${m.photo}" alt="Portrait of ${m.name}" loading="lazy">`
      : `<div class="tc-fallback" aria-hidden="true">${initials}</div>`;
    /* Name renders as an external <a> when a `profile` URL is set on the
       TEAM entry; falls back to a plain <span> otherwise. Only the name
       is the click target — the surrounding card is decorative. */
    const nameEl = m.profile
      ? `<a class="tc-name tc-name-link" href="${m.profile}" target="_blank" rel="noopener noreferrer">${m.name}<span class="tc-name-arrow" aria-hidden="true">↗</span></a>`
      : `<span class="tc-name">${m.name}</span>`;
    return `
      <article class="team-card">
        <div class="tc-media">${media}</div>
        <div class="tc-overlay">
          <h4 class="tc-name-wrap">${nameEl}</h4>
          <p class="tc-sub">${m.badge} · Stanford Medicine</p>
          <p class="tc-role">${m.role}</p>
        </div>
      </article>`;
  }).join('');
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
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    /* Gentle breathing animation around each node's anchor */
    const all = nodes.concat([nucleus]);
    all.forEach(n => {
      if (n.ax === undefined) return;
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
  requestAnimationFrame(frame);
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

  const reportModal = byId('report-modal');
  reportModal.addEventListener('click', e => {
    if (e.target === reportModal) closeReportModal();
  });
  byId('rm-close').addEventListener('click', closeReportModal);

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (modal.classList.contains('open'))       { closeVideo(); return; }
    if (reportModal.classList.contains('open')) { closeReportModal(); return; }
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
  const btn = byId('fg-pause-btn');
  if (!btn) return;   /* footer-global isn't on every page in every build */
  const label = byId('fg-pause-label');

  const applyState = paused => {
    document.body.classList.toggle('motion-paused', paused);
    btn.setAttribute('aria-pressed', String(paused));
    label.textContent = paused ? 'Play Media' : 'Pause Media';
  };

  applyState(localStorage.getItem('heal-ai-motion-paused') === '1');

  btn.addEventListener('click', () => {
    const next = !document.body.classList.contains('motion-paused');
    localStorage.setItem('heal-ai-motion-paused', next ? '1' : '0');
    applyState(next);
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

  RESOURCE_CATEGORIES.forEach(cat => {
    if (cat.items) {
      cat.items.forEach(item => add(item.h, item.sub, 'resources', { tabId: cat.id }));
    }
    if (cat.reports) {
      cat.reports.forEach(r => add(r.name, r.sub, 'resources', { tabId: cat.id, reportCode: r.code }));
    }
    if (cat.media) {
      add(cat.media.featured.title, cat.media.featured.desc, 'resources', { tabId: cat.id });
      cat.media.talks.forEach(t => add(t.h, t.sub, 'resources', { tabId: cat.id }));
      cat.media.grid.forEach(g => add(g.title, g.desc, 'resources', { tabId: cat.id }));
    }
  });

  FURM_STEPS.forEach(s => add(s.title, s.desc, 'process'));
  GET_STARTED_STEPS.forEach(s => add(s.title, s.desc, 'home'));
  PLAYBOOK_CARDS.forEach(c => add(c.h, c.desc, 'playbook'));
  TEAM.forEach(t => add(t.name, t.role, 'about'));
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
    if (m.pageId === 'resources' && m.tabId) activateResourceTab(m.tabId, false);
    if (m.reportCode) openReportDetail(m.reportCode);
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
  renderProcessSteps();
  renderVideos();
  renderResources();
  renderPatientPanel();
  renderPlaybook();
  renderAboutCards();
  renderTeam();

  /* Document-level wiring */
  bindGlobalEvents();
  initPauseMediaControl();
  initSiteSearch();

  /* Hero canvas last — least critical, can run after content is painted */
  initHeroCanvas();
}

/* defer-loaded so the DOM is ready by the time this executes. */
init();
