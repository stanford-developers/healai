/* ─────────────────────────────────────────────────────────────────────────
   VENDORED FILE — DO NOT EDIT HERE
─────────────────────────────────────────────────────────────────────────────
   Copied from the assistant repo, which is where it is developed and
   tested:

     repo    stanford-developers/Heal-ai-bot  (~/Desktop/heal-ai-assistant)
     path    widget/heal-ai-assistant.js
     commit  9a1b362 (branch main)
     copied  2026-11-17

   It lives here because the website is a static GitHub Pages site and can
   only serve files that are in this repository. Edits belong upstream; a
   fix made here is lost the next time the file is re-copied.

   To see whether this copy has drifted from upstream:
     tail -n +21 js/heal-ai-assistant.js \
       | diff - ~/Desktop/heal-ai-assistant/widget/heal-ai-assistant.js
─────────────────────────────────────────────────────────────────────────── */

/*
═════════════════════════════════════════════════════════════════════════
 HEAL-AI · widget/heal-ai-assistant.js
─────────────────────────────────────────────────────────────────────────
 The assistant on the website: a small launcher in the bottom-right
 corner that opens a floating conversation panel over the current page.
 Vanilla, no build step, no dependencies — the site has none and this
 should not be the reason it acquires one.

 It knows one endpoint and nothing else. There is no model name in here,
 no key, no provider: the page posts a question to our own server and
 renders what comes back. That is the whole point of the server existing.

 Usage:
   <div data-heal-ai-assistant data-endpoint="https://…/api/ask"></div>
   <script src="heal-ai-assistant.js" defer></script>

 The page may also drive it:
   window.HealAIAssistant.open()        open the panel
   window.HealAIAssistant.ask("…")      open it and ask a question
   window.HealAIAssistant.minimise()    hide it, keeping the conversation

 THE LAYOUT ("Evidence First")
   Each turn shows the question ("You asked"), then, for an actual
   answer only, a row of source cards, then the answer under two plain
   headings: "In short" over the opening sentences and "Details" over
   the list of points. The numbers in the answer are buttons that bring
   their card into view and highlight it.

 FULL SCREEN
   A button in the header turns the floating panel into a window that
   fills the browser, with the text in a centred column about 760px
   wide. While it is full screen it behaves as a modal dialog: the page
   behind does not scroll, Tab stays inside, and Escape first leaves
   full screen, then (pressed again) minimises. It is CSS, not the
   browser's Fullscreen API, which would hide the browser's own controls.
   Full screen is remembered across minimise and reopen, and reset by
   Close, which clears everything.

 WHAT "MINIMISE" AND "CLOSE" MEAN
   Minimise hides the panel and keeps the conversation for as long as
   the page is open. Close hides it and clears the conversation. Nothing
   is written to the browser's storage either way: a reload starts
   fresh, which is the privacy-respecting default for a box people may
   type health questions into.

 EACH QUESTION STANDS ALONE
   The server answers one question at a time and is not sent earlier
   ones. The panel says so, because a conversation that looks like it
   remembers invites "and what about the second one?", which it cannot
   answer.
═════════════════════════════════════════════════════════════════════════
*/

(function () {
  'use strict';

  var MAX = 500;   // must match LIMITS.maxQuestionChars on the server
  var CMAX = 300;  // must match LIMITS.maxCommentChars

  /* Four questions, shown before anybody has typed anything.
     An empty box is a bad first impression: the reader has to invent a
     question on the spot, and the one they invent is usually either
     trivial or something this cannot answer. Each is a different kind
     of question the assistant is actually good at. */
  var STARTERS = [
    'What did the ambient scribe assessment find?',
    'How does the ethics team run an assessment?',
    'What concerns come up most often across the reports?',
    'Which tools has HEAL-AI assessed so far?'
  ];

  var TITLE = 'Ask about HEAL-AI’s work';
  /* Where a "not covered" reply points. Site routes on heal-ai.stanford.edu. */
  var CONTACT_HREF = '#about';
  var TOOLKIT_HREF = '#toolkit';
  var SUBTITLE = 'Answers from published material';
  var STANDALONE = 'Each question is answered on its own; earlier ones are not remembered.';

  var NOTE =
    'Beta: AI-generated answers can be inaccurate. Check the linked original sources. ' +
    'Not medical, legal or clinical advice.';

  /* Shown until the server says otherwise, and kept if it cannot be
     asked. The notice is a disclosure, so it fails towards saying more:
     the previous version showed nothing when the health check failed,
     while the server went on logging questions. */
  var PRIVACY_UNKNOWN =
    'Questions may be logged to improve the assistant. Please do not ' +
    'type patient details or anything confidential.';
  var PRIVACY_OFF =
    'The text of your question is not stored. Please still avoid typing ' +
    'patient details or anything confidential.';

  /* The one line under the box. It names the three things a visitor must
     know before typing (it can be wrong, it is not advice, it is saved);
     "Details" opens the full notice the server sends. The saved part
     follows the server: unknown until /api/health answers, then the real
     retention period, or "not saved" when logging is off. */
  /* Short enough for one line on a phone; the header already says Beta. */
  var LINE_HEAD = 'Can be wrong · Not medical advice · ';
  var SAVED_UNKNOWN = 'May be saved';
  var SAVED_ON = 'Questions saved';
  var SAVED_OFF = 'Not saved';
  function savedFor(days) { return 'Saved ' + days + ' days'; }

  /* The full-screen button's name says what pressing it will do. */
  var FULL_ON = 'Expand to full screen';
  var FULL_OFF = 'Exit full screen';

  function svg(body) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + body + '</svg>';
  }
  var S = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
  var ICON = {
    chat: svg('<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.2 3.6A.5.5 0 0 1 5 19.2V16h-.5A.5.5 0 0 1 4 15.5z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M8.5 8.5h7M8.5 11.5h4.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>'),
    minus: svg('<path d="M6 12h12" ' + S + '/>'),
    close: svg('<path d="M7 7l10 10M17 7L7 17" ' + S + '/>'),
    expand: svg('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" ' + S + '/>'),
    shrink: svg('<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" ' + S + '/>'),
    send: svg('<path d="M12 19V5M6 11l6-6 6 6" ' + S + ' stroke-width="2"/>'),
    out: svg('<path d="M14 5h5v5M19 5l-8 8M17 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h4" ' + S + '/>'),
    arrow: svg('<path d="M5 12h14M13 6l6 6-6 6" ' + S + '/>'),
    check: svg('<path d="M5 12.5l4.2 4.2L19 7" ' + S + ' stroke-width="2.2"/>'),
    chevDown: svg('<path d="M6 9l6 6 6-6" ' + S + '/>'),
    docs: svg('<path d="M8 3h7l4 4v11H8z" ' + S + '/><path d="M5 7v14h10" ' + S + '/>'),
    star: svg('<path d="M12 3.5l1.9 5.6 5.6 1.9-5.6 1.9L12 18.5l-1.9-5.6L4.5 11l5.6-1.9z" fill="currentColor"/>'),
    info: svg('<circle cx="12" cy="12" r="8.5" ' + S + '/><path d="M12 11v5M12 8h.01" ' + S + ' stroke-width="2"/>'),
    shield: svg('<path d="M12 3l7 3v5c0 4.6-3 8-7 10-4-2-7-5.4-7-10V6z" ' + S + '/><path d="M9 12h6" ' + S + '/>'),
    searchX: svg('<circle cx="10.5" cy="10.5" r="6.5" ' + S + '/><path d="M15.5 15.5L20 20M8.5 8.5l4 4M12.5 8.5l-4 4" ' + S + '/>'),
    eyeOff: svg('<path d="M3 3l18 18M10.6 6.1A9.8 9.8 0 0 1 12 6c5 0 8.5 4.5 9.5 6-.5.8-1.6 2.2-3.1 3.5M6.4 7.6C4.5 8.9 3.1 10.8 2.5 12c1 1.5 4.5 6 9.5 6 1.5 0 2.9-.4 4.1-1M9.9 10a3 3 0 0 0 4.1 4.1" ' + S + '/>'),
    pause: svg('<circle cx="12" cy="12" r="8.5" ' + S + '/><path d="M10 9v6M14 9v6" ' + S + '/>'),
    clock: svg('<circle cx="12" cy="12" r="8.5" ' + S + '/><path d="M12 7.5V12l3 2" ' + S + '/>'),
    offline: svg('<path d="M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 12.9a10 10 0 0 1 5-2.7M14.5 10.3a10 10 0 0 1 4.5 2.6M2 9.3a14.5 14.5 0 0 1 4.3-2.7M10.4 5.1A14.5 14.5 0 0 1 22 9.3M12 20h.01" ' + S + '/>'),
    retry: svg('<path d="M4 12a8 8 0 0 1 13.7-5.6L20 8.7M20 4v4.7h-4.7M20 12a8 8 0 0 1-13.7 5.6L4 15.3M4 20v-4.7h4.7" ' + S + '/>')
  };

  /* Escapes text before it goes anywhere near innerHTML. The answer comes
     from a model, which means it is untrusted text that may contain
     anything; rendering it raw would be an injection waiting to happen. */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* Turns [1] into a button that brings source 1 of THIS answer into
     view. Runs on text that is already escaped, so the only markup it
     can produce is its own. */
  function linkCitations(escaped, max) {
    /* [1], and lists such as [1,3,4] or [1, 3], which some models write.
       Out of range: shown plainly, never linked. With max 0 (a reply that
       is not an answer) nothing is linked at all. */
    return escaped.replace(/\[(\d+(?:\s*,\s*\d+)*)\]/g, function (whole, list) {
      var nums = list.split(/\s*,\s*/).map(function (n) { return parseInt(n, 10); });
      if (!nums.every(function (i) { return i >= 1 && i <= max; })) return whole;
      return '<span class="ha-cites">' + nums.map(function (i) {
        return '<button type="button" class="ha-cite" data-to="' + i +
               '" aria-label="Source ' + i + '">' + i + '</button>';
      }).join('') + '</span>';
    });
  }

  /* Only web links and in-page links. A source href comes from our own
     server, but a javascript: URL in an href is executed on click, and
     the server is one more thing that could be wrong. */
  function safeLink(href) {
    if (!href) return null;
    try {
      var u = new URL(href, window.location.href);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
      return { href: String(href), external: u.origin !== window.location.origin };
    } catch (e) { return null; }
  }

  function reducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  /* A one-word kind for a label that does not name its own. */
  function typeWord(s) {
    var l = String(s).toLowerCase();
    return /report/.test(l) ? 'Report'
      : /playbook/.test(l) ? 'Playbook'
      : /template/.test(l) ? 'Template'
      : /video/.test(l) ? 'Video'
      : /protocol|guide|resource|checklist|form|toolkit/.test(l) ? 'Resource'
      : 'Document';
  }

  /* A source label, split for its card:
       "Ethics report: Scribe — Consent and transparency"
         → type "Ethics report", title "Scribe", section "Consent and transparency"
     Only the first " — " and the first ":" count, so a title that
     contains either keeps the rest. A label with neither is the title,
     and the type is guessed from it. Nothing here is trusted: every
     part is escaped where it is written. */
  function parseLabel(label, n) {
    var full = String(label == null ? '' : label).replace(/\s+/g, ' ').trim() || ('Source ' + n);
    var head = full, section = '';
    var d = full.search(/\s[—–]\s/);
    if (d > 0) { head = full.slice(0, d).trim(); section = full.slice(d + 3).trim(); }
    var type = '', title = head;
    var c = head.indexOf(':');
    if (c > 0 && c < head.length - 1) {
      type = head.slice(0, c).trim();
      title = head.slice(c + 1).trim();
    }
    // A long prefix is not a type, it is part of a sentence.
    if (!type || type.length > 24) type = typeWord(type || head);
    if (!title) { title = full; section = ''; }
    return { type: type, title: title, section: section, full: full };
  }

  /* Say what the link actually does. Sending somebody to a list of
     reports while implying a paragraph is worse than saying so. */
  function linkNote(s) {
    if (s.precision === 'section-list') return 'Opens the list of reports';
    if (s.precision === 'document-pending') {
      return /^#reports\b/.test(s.href || '') ? 'Opens in Sample Reports' : 'Opens the page that lists it';
    }
    return '';
  }

  /* The prompt asks for two or three sentences, then an optional list
     of issues written as "- " lines. Rendered as paragraphs and a real
     <ul>: a hyphen at the start of a line is a list to a sighted reader
     and nothing at all to a screen reader. The paragraphs before the
     first point are the lead ("In short"); the points, and anything
     after them, are the body ("Details"). */
  function renderAnswer(text, max) {
    var lead = '', body = '', bullets = [], seenList = false;
    function flush() {
      if (!bullets.length) return;
      body += '<ul class="ha-points">' + bullets.join('') + '</ul>';
      bullets = [];
    }
    String(text).split('\n').forEach(function (raw) {
      var line = raw.trim();
      if (!line) { flush(); return; }
      var m = line.match(/^[-•*]\s+(.*)$/);
      if (m) { seenList = true; bullets.push('<li>' + linkCitations(esc(m[1]), max) + '</li>'); }
      else {
        flush();
        var p = '<p class="ha-para">' + linkCitations(esc(line), max) + '</p>';
        if (seenList) body += p; else lead += p;
      }
    });
    flush();
    return { lead: lead, body: body };
  }

  /* What kind of reply this is, from what the server says happened.
     Each kind gets a plain label, so a refusal does not look like a
     malfunction and a withheld answer does not look like an answer. */
  function kindOf(data) {
    if (data.degraded) return { k: 'limited', label: 'Limited service' };
    if (data.withheld) return { k: 'withheld', label: 'Answer withheld' };
    if (data.refused_before_model && data.blocked_by) return { k: 'refused', label: 'Outside what this can answer' };
    if (data.refused) return { k: 'declined', label: 'Not covered by the material' };
    return { k: 'answer', label: null };
  }

  var STATUS_ICON = {
    refused: ICON.shield,
    declined: ICON.searchX,
    withheld: ICON.eyeOff,
    limited: ICON.pause
  };

  /* ── mounting ──────────────────────────────────────────────────── */

  var instances = 0;

  function mount(root) {
    if (root.getAttribute('data-ha-mounted')) return null;
    root.setAttribute('data-ha-mounted', '1');

    var id = 'ha' + (++instances);
    var endpoint = root.getAttribute('data-endpoint') || '/api/ask';
    /* Derived from the ask endpoint rather than configured separately,
       so a site that mounts the widget under a prefix gets both
       without having to know there are two. */
    var feedbackEndpoint = root.getAttribute('data-feedback-endpoint') ||
      endpoint.replace(/\/ask$/, '/feedback');
    var healthEndpoint = endpoint.replace(/\/ask$/, '/health');

    var busy = false;
    var generation = 0;      // bumped by Close, so a late reply is dropped
    var turn = 0;            // per-answer id prefix
    var healthChecked = false;
    var full = false;        // full screen; kept by minimise, reset by close

    root.classList.add('ha-assistant');
    root.setAttribute('data-full', 'false');
    root.innerHTML =
      '<button type="button" class="ha-launcher" aria-expanded="false" aria-controls="' + id + '-win">' +
        ICON.chat + '<span class="ha-launcher-text">Ask a question</span>' +
        '<span class="ha-unread" hidden><span class="ha-sr-only">, new answer</span></span>' +
      '</button>' +
      '<section class="ha-window" id="' + id + '-win" role="dialog" aria-modal="false" ' +
        'aria-labelledby="' + id + '-title" aria-describedby="' + id + '-sub" hidden>' +
        '<header class="ha-head">' +
          '<span class="ha-head-mark" aria-hidden="true">' + ICON.docs + '</span>' +
          '<div class="ha-head-text">' +
            '<h2 class="ha-title" id="' + id + '-title">' + esc(TITLE) + '</h2>' +
            '<p class="ha-sub" id="' + id + '-sub"><span class="ha-beta">Beta</span> ' + esc(SUBTITLE) + '</p>' +
          '</div>' +
          '<div class="ha-head-actions">' +
            '<button type="button" class="ha-icon-btn ha-full" aria-label="' + FULL_ON + '" title="' + FULL_ON + '">' +
              '<span class="ha-ic-expand">' + ICON.expand + '</span><span class="ha-ic-shrink">' + ICON.shrink + '</span>' +
            '</button>' +
            '<button type="button" class="ha-icon-btn ha-min" aria-label="Minimise (keeps this conversation)" title="Minimise">' + ICON.minus + '</button>' +
            '<button type="button" class="ha-icon-btn ha-close" aria-label="Close and clear this conversation" title="Close and clear">' + ICON.close + '</button>' +
          '</div>' +
        '</header>' +
        '<div class="ha-service" role="status" hidden></div>' +
        /* The log is not itself live: read out whole, a reply starts with
           every source card (number, type, title, section, "Cited") before
           a word of the answer. A short line goes to .ha-live instead. */
        '<div class="ha-log" role="log" aria-live="off" aria-label="Conversation" tabindex="0"></div>' +
        '<div class="ha-live ha-sr-only" role="status" aria-live="polite" aria-atomic="true"></div>' +
        '<footer class="ha-foot">' +
          '<form class="ha-form" novalidate>' +
            '<label class="ha-sr-only" for="' + id + '-q">Ask a question about HEAL-AI’s work</label>' +
            '<div class="ha-composer">' +
              '<textarea id="' + id + '-q" class="ha-input" rows="1" maxlength="' + MAX + '" ' +
                'placeholder="Ask about HEAL-AI’s work…" aria-describedby="' + id + '-count"></textarea>' +
              '<div class="ha-composer-bar">' +
                '<span class="ha-hint" aria-hidden="true"><kbd>Enter</kbd> to send · <kbd>Shift</kbd> + <kbd>Enter</kbd> new line</span>' +
                '<span class="ha-count" id="' + id + '-count"></span>' +
                '<button type="submit" class="ha-send" aria-label="Send question">' + ICON.send + '</button>' +
              '</div>' +
            '</div>' +
          '</form>' +
          '<p class="ha-note ha-line">' +
            '<span class="ha-line-text">' + esc(LINE_HEAD) + '<span class="ha-saved">' + esc(SAVED_UNKNOWN) + '</span></span>' +
            '<button type="button" class="ha-more" aria-expanded="false" aria-controls="' + id + '-notice">' +
              '<span class="ha-more-t">Details</span>' + ICON.chevDown + '</button>' +
          '</p>' +
          '<div class="ha-notice" id="' + id + '-notice" hidden>' +
            '<p class="ha-note">' + esc(NOTE) + '</p>' +
            '<p class="ha-note ha-privacy">' + esc(PRIVACY_UNKNOWN) + '</p>' +
          '</div>' +
        '</footer>' +
      '</section>';

    var launcher = root.querySelector('.ha-launcher');
    var unread   = root.querySelector('.ha-unread');
    var win      = root.querySelector('.ha-window');
    var log      = root.querySelector('.ha-log');
    var service  = root.querySelector('.ha-service');
    var form     = root.querySelector('.ha-form');
    var input    = root.querySelector('.ha-input');
    var send     = root.querySelector('.ha-send');
    var count    = root.querySelector('.ha-count');
    var privacy  = root.querySelector('.ha-privacy');
    var saved    = root.querySelector('.ha-saved');
    var more     = root.querySelector('.ha-more');
    var notice   = root.querySelector('.ha-notice');
    var fullBtn  = root.querySelector('.ha-full');
    var live     = root.querySelector('.ha-live');

    /* What a screen reader hears when something arrives: one short line.
       Emptied first, so the same words twice are still read twice. */
    var liveTimer = null;
    function announce(text) {
      clearTimeout(liveTimer);
      live.textContent = '';
      liveTimer = setTimeout(function () {
        live.textContent = String(text || '').replace(/\s+/g, ' ').trim();
      }, 60);
    }
    more.addEventListener('click', function () {
      var open = more.getAttribute('aria-expanded') !== 'true';
      more.setAttribute('aria-expanded', String(open));
      more.querySelector('.ha-more-t').textContent = open ? 'Hide' : 'Details';
      notice.hidden = !open;
    });

    function intro() {
      log.innerHTML =
        '<div class="ha-intro">' +
          '<div class="ha-intro-art" aria-hidden="true">' +
            ['Report', 'Playbook', 'Template'].map(function (c, i) {
              return '<div class="ha-ghost"><div class="ha-ghost-top"><span class="ha-badge">' + (i + 1) +
                     '</span><span class="ha-ghost-c">' + c + '</span></div><i></i><i></i></div>';
            }).join('') +
          '</div>' +
          '<h3 class="ha-intro-h">Every answer starts with its sources.</h3>' +
          '<p class="ha-intro-lede">Ask about the playbook, the ethics assessments, the templates or the patient panel. ' +
          'The documents used are shown first, and the numbers in the answer link back to them.</p>' +
          '<p class="ha-kicker ha-try" id="' + id + '-try">Try a question</p>' +
          '<div class="ha-starters" role="group" aria-labelledby="' + id + '-try">' +
            STARTERS.map(function (q) {
              return '<button type="button" class="ha-starter"><span>' + esc(q) + '</span>' + ICON.arrow + '</button>';
            }).join('') +
          '</div>' +
          '<p class="ha-standalone">' + ICON.info + '<span>' + esc(STANDALONE) + '</span></p>' +
        '</div>';
      log.querySelectorAll('.ha-starter').forEach(function (b) {
        b.addEventListener('click', function () { ask(b.textContent); });
      });
    }

    function updateCount() {
      var n = input.value.length;
      count.textContent = n > MAX * 0.8 ? n + ' / ' + MAX : '';
      count.setAttribute('data-over', String(n >= MAX));
      // Collapse first so scrollHeight reports the content, not the box
      // we last grew it to.
      input.style.height = 'auto';
      var want = input.scrollHeight;
      input.style.overflowY = want > 140 ? 'auto' : 'hidden';
      input.style.height = Math.min(want, 140) + 'px';
      send.disabled = busy || !input.value.trim();
    }

    /* ── open, minimise, close, full screen ────────────────────────── */

    var hideTimer = null;
    function isOpen() { return root.getAttribute('data-open') === 'true'; }

    /* Full screen is a state of the open panel. While the panel is open
       and full screen it is a modal dialog (aria-modal, focus kept in,
       page behind locked); minimised, nothing about the page changes. */
    function applyFull() {
      var modal = full && isOpen();
      root.setAttribute('data-full', String(full));
      win.setAttribute('aria-modal', modal ? 'true' : 'false');
      fullBtn.setAttribute('aria-label', full ? FULL_OFF : FULL_ON);
      fullBtn.setAttribute('title', full ? FULL_OFF : FULL_ON);
      document.documentElement.classList.toggle('ha-lock', modal);
      checkCardRows();
    }

    function setFull(on) {
      full = !!on;
      applyFull();
    }

    function open(opts) {
      clearTimeout(hideTimer);
      if (!log.firstChild) intro();
      win.hidden = false;
      /* Measured now, not at mount: the panel starts hidden, a hidden
         textarea reports a scrollHeight of 0, and the box opened
         squashed to a sliver. */
      updateCount();
      /* Read a layout value first so the browser applies the closed
         state before the open one, and the transition runs. Not
         requestAnimationFrame: a frame that never comes (a throttled
         background tab) would leave the panel open but transparent. */
      void win.offsetWidth;
      root.setAttribute('data-open', 'true');
      launcher.setAttribute('aria-expanded', 'true');
      unread.hidden = true;
      applyFull();
      checkHealth();
      /* Opened full screen, the panel is a modal at once, so focus goes
         in at once, even when the page asked for no focus (ask() from a
         site button): otherwise a keyboard user is left on a control
         hidden under the window, where Escape does nothing. */
      if (full && !win.contains(document.activeElement)) {
        input.focus({ preventScroll: true });
      } else if (!opts || opts.focus !== false) {
        setTimeout(function () { input.focus({ preventScroll: true }); }, reducedMotion() ? 0 : 60);
      }
    }

    function hide(opts) {
      root.setAttribute('data-open', 'false');
      launcher.setAttribute('aria-expanded', 'false');
      applyFull();
      hideTimer = setTimeout(function () { win.hidden = true; }, reducedMotion() ? 0 : 220);
      if (!opts || opts.focus !== false) launcher.focus({ preventScroll: true });
    }

    function minimise() { hide(); }

    function close() {
      generation++;              // any reply still in flight is now stale
      busy = false;
      full = false;
      input.value = '';
      updateCount();
      hide();
      log.innerHTML = '';
    }

    /* What Tab may land on inside the window, in order. */
    function focusables() {
      return Array.prototype.filter.call(
        win.querySelectorAll('a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'),
        function (el) { return el.getClientRects().length > 0 && !el.closest('[hidden]'); });
    }

    launcher.addEventListener('click', function () { if (isOpen()) minimise(); else open(); });
    fullBtn.addEventListener('click', function () { setFull(!full); fullBtn.focus({ preventScroll: true }); });
    root.querySelector('.ha-min').addEventListener('click', minimise);
    root.querySelector('.ha-close').addEventListener('click', close);
    win.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        // One step at a time: full screen first, then the panel.
        if (full) { setFull(false); fullBtn.focus({ preventScroll: true }); }
        else minimise();
        return;
      }
      // Full screen is modal: Tab and Shift+Tab wrap inside the window.
      if (e.key === 'Tab' && full && isOpen()) {
        var f = focusables();
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && (document.activeElement === first || !win.contains(document.activeElement))) {
          e.preventDefault(); last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault(); first.focus();
        }
      }
    });
    /* A modal keeps focus. Anything that moves it behind the full-screen
       window (a script on the page, a click that lands outside) brings
       it back to the control that leaves full screen. */
    document.addEventListener('focusin', function (e) {
      if (full && isOpen() && !win.contains(e.target)) fullBtn.focus({ preventScroll: true });
    });
    window.addEventListener('resize', function () { checkCardRows(); });

    /* ── the service, and what the visitor is told about logging ──── */

    function checkHealth() {
      if (healthChecked) return;
      healthChecked = true;
      fetch(healthEndpoint, { headers: { Accept: 'application/json' } })
        .then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
        .then(function (h) {
          service.hidden = true;
          if (h && h.notice) privacy.textContent = h.notice;
          else if (h && h.logging_questions === false) privacy.textContent = PRIVACY_OFF;
          if (h && h.logging_questions === false) saved.textContent = SAVED_OFF;
          else if (h && h.logging_questions === true) saved.textContent = Number(h.log_days) > 0 ? savedFor(Number(h.log_days)) : SAVED_ON;
          // anything else: keep the conservative wording
        })
        .catch(function () {
          healthChecked = false;  // try again on the next open or question
          service.innerHTML =
            '<strong>The assistant can’t be reached right now.</strong> ' +
            'You can still try a question, or browse the reports and resources on this site.';
          service.hidden = false;
        });
    }

    /* ── rendering a reply ─────────────────────────────────────────── */

    /* The row of source cards above an answer. One card per source, and
       the card is the link. Called only for an actual answer (render). */
    function sourceCards(sources, pre) {
      var cited = sources.filter(function (s) { return s.cited; }).length;
      var cards = sources.map(function (s, i) {
        // A whole number, whatever the server sent: it goes into ids.
        var n = parseInt(s.n, 10) || (i + 1);
        var p = parseLabel(s.label, n);
        var link = safeLink(s.href);
        var cid = pre + '-src-' + n;
        var note = link ? linkNote(s) : 'No link available';
        var name = '<span class="ha-sr-only">Source ' + n + ': </span>' + esc(p.title);
        var titleEl = link
          ? '<a class="ha-card-link" href="' + esc(link.href) + '" title="' + esc(p.full) + '"' +
              (link.external ? ' target="_blank" rel="noopener noreferrer"' : '') +
              ' aria-describedby="' + cid + '-type ' + cid + '-meta ' + cid + '-mark">' + name +
              (link.external ? '<span class="ha-sr-only"> (opens in a new tab)</span>' : '') + '</a>'
          : '<span class="ha-card-title">' + name + '</span>';
        return '<li class="ha-card" id="' + cid + '" tabindex="-1" data-n="' + n + '" data-cited="' + !!s.cited + '">' +
            '<span class="ha-card-top">' +
              '<span class="ha-badge" aria-hidden="true">' + n + '</span>' +
              '<span class="ha-chip" id="' + cid + '-type">' + esc(p.type) + '</span>' +
              (link && link.external ? '<span class="ha-card-out">' + ICON.out + '</span>' : '') +
            '</span>' +
            titleEl +
            '<span class="ha-card-meta" id="' + cid + '-meta">' +
              (p.section ? '<span class="ha-card-sec">' + esc(p.section) + '</span>' : '') +
              (note ? '<span class="ha-card-note">' + esc(note) + '</span>' : '') +
            '</span>' +
            (s.cited
              ? '<span class="ha-card-mark" id="' + cid + '-mark">' + ICON.check + 'Cited</span>'
              : '<span class="ha-card-mark is-muted" id="' + cid + '-mark">Not cited</span>') +
          '</li>';
      }).join('');
      return '<div class="ha-sources">' +
          '<div class="ha-sec-head"><h3 class="ha-sec-h">' + ICON.docs + 'Sources</h3>' +
            '<span class="ha-sec-meta">' + sources.length + ' found · ' + cited + ' cited</span></div>' +
          '<div class="ha-cards-wrap"><ol class="ha-cards" aria-label="Sources for this answer">' + cards + '</ol></div>' +
        '</div>';
    }

    function ratingHtml(exchange, t) {
      var rl = id + '-t' + t + '-rl';
      return '<div class="ha-rate" data-exchange="' + esc(exchange) + '">' +
          '<span class="ha-rate-label" id="' + rl + '">Was this useful?</span>' +
          '<button type="button" class="ha-thumb" data-verdict="up" aria-describedby="' + rl + '">Yes</button>' +
          '<button type="button" class="ha-thumb" data-verdict="down" aria-describedby="' + rl + '">No</button>' +
        '</div>';
    }

    function render(msg, data) {
      var t = ++turn;
      var pre = id + '-t' + t;
      var sources = data.sources || [];
      var kind = kindOf(data);
      var html = '';

      /* Only ever true against a server with no model configured:
         local development, or the preview page. Said on the reply so a
         screenshot of a fixture cannot pass for a real one. */
      if (data.stub) {
        html += '<div class="ha-tags"><span class="ha-tag ha-tag-dev">Development fixture — not a real answer</span></div>';
      }

      /* Sources and citations belong to an answer. A refusal, a declined
         question, a withheld answer or limited service shows none: listing
         documents under "I can't answer that" reads as if they were the
         answer, or as if the assistant were hinting at one. The server
         does send sources with those replies; they are dropped here. */
      var showSources = kind.k === 'answer' && sources.length > 0;

      if (kind.k === 'answer') {
        if (showSources) {
          html += sourceCards(sources, pre);
          html += '<div class="ha-sec-head ha-ans-head"><h3 class="ha-sec-h">' + ICON.star + 'Answer</h3></div>';
        }
        /* "In short" and "Details": plain headings a reader can skim and
           a screen reader can jump between. Under "Answer" they are one
           level down. */
        var hl = showSources ? 'h4' : 'h3';
        var parts = renderAnswer(data.answer || '', showSources ? sources.length : 0);
        html += '<div class="ha-answer">';
        if (parts.lead) {
          html += '<div class="ha-part"><' + hl + ' class="ha-part-h">In short</' + hl + '>' + parts.lead + '</div>';
        }
        if (parts.body) {
          html += '<div class="ha-part"><' + hl + ' class="ha-part-h">Details</' + hl + '>' + parts.body + '</div>';
        }
        html += '</div>';
      } else {
        /* A reply that is not an answer: a compact card with its label.
           The text is escaped like an answer's, and nothing is linked. */
        var plain = renderAnswer(data.answer || '', 0);
        html += '<div class="ha-status ha-status-' + kind.k + '">' +
            '<div class="ha-status-head"><span class="ha-status-ic" aria-hidden="true">' + (STATUS_ICON[kind.k] || ICON.info) + '</span>' +
              '<strong class="ha-tag ha-tag-' + kind.k + '">' + esc(kind.label) + '</strong></div>' +
            '<div class="ha-answer">' + plain.lead + plain.body + '</div>';
        /* Not covered: say where a person can help, as the V1 plan asks. */
        if (kind.k === 'declined') {
          html += '<p class="ha-next">Not covered here? <a href="' + esc(CONTACT_HREF) + '">Contact the HEAL-AI team</a> ' +
                  'or browse the reports and resources in the <a href="' + esc(TOOLKIT_HREF) + '">Toolkit</a>.</p>';
        }
        html += '</div>';
      }

      /* A rating on every reply that carries an exchange id, refusals
         included: a fair question that was refused has no other way
         to be reported, and over-blocking is the failure nobody sees. */
      if (data.exchange) html += ratingHtml(data.exchange, t);

      msg.removeAttribute('aria-busy');
      msg.className = 'ha-a ha-kind-' + kind.k;
      msg.innerHTML = html;

      var rate = msg.querySelector('.ha-rate');
      if (rate) wireRating(rate);
      watchCards(msg);

      // Start the reader at the top of this turn: the question, then
      // the sources, then the answer.
      var turnEl = msg.closest('.ha-turn') || msg;
      scrollToTurn(turnEl);
      announce(summary(msg, kind, showSources ? sources.length : 0));
      if (!isOpen()) unread.hidden = false;
    }

    /* The one line read out for a reply: what kind it is, then its
       opening text. Taken from the rendered, escaped DOM as plain text. */
    function summary(msg, kind, nSources) {
      var lead = msg.querySelector('.ha-part, .ha-status .ha-answer');
      var text = '';
      if (lead) {
        // Without the heading and the citation numbers, which would read
        // as "thirteen" for [1,3].
        var copy = lead.cloneNode(true);
        Array.prototype.forEach.call(copy.querySelectorAll('.ha-part-h, .ha-cites'), function (n) { n.remove(); });
        text = copy.textContent.replace(/\s+([.,;:])/g, '$1');
      }
      var head = kind.k === 'answer'
        ? 'Answer received' + (nSources ? ', ' + nSources + (nSources === 1 ? ' source' : ' sources') : '') + '. '
        : kind.label + '. ';
      return head + text;
    }

    /* The log scrolls, except in a short window, where the whole window
       does (see the CSS); scroll whichever one actually can. */
    function scrollToTurn(turnEl) {
      var top = Math.max(0, turnEl.offsetTop - 8);
      if (log.scrollHeight > log.clientHeight + 1) log.scrollTop = top;
      else if (win.scrollHeight > win.clientHeight + 1) win.scrollTop = Math.max(0, log.offsetTop + top);
    }

    /* A row of cards scrolls sideways on the floating panel. When it
       does, the row itself takes focus, so the arrow keys can scroll it
       even when a card has no link; when it fits (or wraps, in full
       screen) it leaves the tab order. */
    function checkCardRows() {
      log.querySelectorAll('.ha-cards-wrap').forEach(function (wrap) {
        var row = wrap.querySelector('.ha-cards');
        var over = row.scrollWidth > row.clientWidth + 2;
        wrap.classList.toggle('is-overflow', over);
        wrap.classList.toggle('at-end', row.scrollLeft + row.clientWidth >= row.scrollWidth - 4);
        if (over) row.setAttribute('tabindex', '0'); else row.removeAttribute('tabindex');
      });
    }

    function watchCards(msg) {
      var row = msg.querySelector('.ha-cards');
      if (!row) return;
      row.addEventListener('scroll', checkCardRows, { passive: true });
      checkCardRows();
    }

    /* A citation chip: bring its card into view and highlight it, with
       every chip in the answer that points at the same source. */
    function showSource(cite) {
      var scope = cite.closest('.ha-a');
      var n = cite.getAttribute('data-to');
      var card = scope && scope.querySelector('.ha-card[data-n="' + n + '"]');
      if (!card) return;
      scope.querySelectorAll('.ha-card.is-target').forEach(function (c) { c.classList.remove('is-target'); });
      scope.querySelectorAll('.ha-cite.is-on').forEach(function (c) { c.classList.remove('is-on'); });
      card.classList.add('is-target');
      scope.querySelectorAll('.ha-cite[data-to="' + n + '"]').forEach(function (c) { c.classList.add('is-on'); });
      card.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
      card.focus({ preventScroll: true });
    }

    function narrow() {
      return !!(window.matchMedia && window.matchMedia('(max-width: 560px)').matches);
    }

    log.addEventListener('click', function (e) {
      var el = e.target && e.target.closest ? e.target : null;
      if (!el) return;
      var cite = el.closest('.ha-cite');
      if (cite) { showSource(cite); return; }
      /* A link to another part of this site, followed from a panel that
         covers the page (full screen, or a phone), would change a page
         nobody can see. Minimise, so the reader lands where it went. */
      var a = el.closest('a[href]');
      if (a && !a.target && (full || narrow())) {
        var l = safeLink(a.getAttribute('href'));
        if (l && !l.external) { hide({ focus: false }); landAfterLink(); }
      }
    });

    /* After a link has changed the page behind, put focus where it went,
       not on the launcher in the corner: the site's router changes the
       page but does not move focus. First an element the link names,
       then the visible page's main heading, then the launcher. Left
       alone if the page has already put focus somewhere (a dialog). */
    function landAfterLink() {
      var done = false;
      function visible(el) {
        if (!el || root.contains(el) || !el.getClientRects().length) return false;
        var c = window.getComputedStyle(el);
        return c.visibility !== 'hidden' && c.display !== 'none';
      }
      function land() {
        if (done) return;
        done = true;
        window.removeEventListener('hashchange', soon);
        var at = document.activeElement;
        if (at && at !== document.body && !win.contains(at)) return;
        var hash = (window.location.hash || '').slice(1).split('?')[0];
        var byId = null;
        try { byId = hash ? document.getElementById(decodeURIComponent(hash)) : null; } catch (e) { byId = null; }
        var main = document.querySelector('main, [role="main"]') || document.body;
        var target = visible(byId) ? byId
          : Array.prototype.filter.call(main.querySelectorAll('h1'), visible)[0] || null;
        if (!target) { launcher.focus({ preventScroll: true }); return; }
        if (!target.hasAttribute('tabindex') && !/^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(target.tagName)) {
          target.setAttribute('tabindex', '-1');
        }
        target.focus({ preventScroll: true });
      }
      function soon() { setTimeout(land, 0); }
      window.addEventListener('hashchange', soon);
      setTimeout(land, 350);   // the same hash again: no hashchange comes
    }
    log.addEventListener('mouseover', function (e) {
      var cite = e.target && e.target.closest ? e.target.closest('.ha-cite') : null;
      log.querySelectorAll('.ha-card.is-hover').forEach(function (c) { c.classList.remove('is-hover'); });
      if (!cite) return;
      var scope = cite.closest('.ha-a');
      var card = scope && scope.querySelector('.ha-card[data-n="' + cite.getAttribute('data-to') + '"]');
      if (card) card.classList.add('is-hover');
    });

    /* A rating says thank you only once it has actually been accepted.
       The previous version thanked the reader whatever happened, so a
       rating lost to a network error looked delivered. */
    function wireRating(rate) {
      var exchange = rate.getAttribute('data-exchange');
      var labelId = rate.querySelector('.ha-rate-label').id;

      function post(verdict, comment) {
        return fetch(feedbackEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ exchange: exchange, verdict: verdict, comment: comment || undefined })
        }).then(function (r) { if (!r.ok) throw new Error(String(r.status)); });
      }

      function settle(p, okMsg) {
        /* The control that had focus is about to be replaced: keep focus
           in the rating, or a keyboard user is dropped to the page. */
        var hadFocus = rate.contains(document.activeElement);
        /* Focus moved onto the new text reads it; otherwise it is
           announced. Not both, or it is heard twice. */
        function show(html, said) {
          rate.innerHTML = html;
          var d = rate.querySelector('.ha-rate-done');
          if (hadFocus && d) { d.setAttribute('tabindex', '-1'); d.focus({ preventScroll: true }); }
          else announce(said);
        }
        show('<span class="ha-rate-done">Sending…</span>', 'Sending your rating…');
        p.then(function () {
          show('<span class="ha-rate-done">' + ICON.check + esc(okMsg) + '</span>', okMsg);
        }).catch(function () {
          show('<span class="ha-rate-done ha-rate-failed">Your rating could not be sent.</span>', 'Your rating could not be sent.');
        });
      }

      rate.querySelectorAll('.ha-thumb').forEach(function (b) {
        b.addEventListener('click', function () {
          if (b.getAttribute('data-verdict') === 'up') { settle(post('up'), 'Thanks.'); return; }

          var cid = labelId + '-c';
          rate.innerHTML =
            '<label class="ha-comment-label" for="' + cid + '">What was wrong with it? ' +
              '<span>Optional. Please do not include patient details.</span></label>' +
            '<textarea id="' + cid + '" class="ha-comment" rows="2" maxlength="' + CMAX + '"></textarea>' +
            '<div class="ha-comment-actions"><button type="button" class="ha-comment-send">Send</button></div>';
          var box = rate.querySelector('.ha-comment');
          rate.querySelector('.ha-comment-send').addEventListener('click', function () {
            settle(post('down', box.value.trim().slice(0, CMAX)), 'Thanks — that helps.');
          });
          box.focus();
        });
      });
    }

    /* ── asking ────────────────────────────────────────────────────── */

    function append(html, cls) {
      var first = log.querySelector('.ha-intro');
      if (first) first.classList.add('is-compact');
      var el = document.createElement('div');
      el.className = cls;
      el.innerHTML = html;
      log.appendChild(el);
      return el;
    }

    function renderError(msg, err, q) {
      /* A network failure has no message worth showing: "Failed to
         fetch" is the browser's words, not the reader's. */
      var text = err.status ? err.message
        : 'The assistant could not be reached. Check your connection and try again.';
      var label = !err.status ? 'Could not connect'
        : err.status === 429 ? 'Too many questions' : 'Service unavailable';
      msg.removeAttribute('aria-busy');
      msg.className = 'ha-a ha-kind-error';
      msg.innerHTML = '<div class="ha-error">' +
          '<div class="ha-status-head"><span class="ha-status-ic" aria-hidden="true">' +
            (err.status === 429 ? ICON.clock : ICON.offline) + '</span><strong>' + esc(label) + '</strong></div>' +
          '<p>' + esc(text) + '</p>' +
          '<button type="button" class="ha-retry">' + ICON.retry + 'Try again</button>' +
        '</div>';
      msg.querySelector('.ha-retry').addEventListener('click', function () {
        if (busy) return;
        var turnEl = msg.closest('.ha-turn');
        // The button is about to go; keep focus in the panel.
        input.focus({ preventScroll: true });
        if (turnEl) turnEl.remove(); else msg.remove();
        ask(q);
      });
      announce(label + '. ' + text);
      if (!isOpen()) unread.hidden = false;
    }

    function ask(question) {
      var q = String(question || '').trim();
      if (!q || busy) return;
      if (!isOpen()) open({ focus: false });
      if (q.length > MAX) q = q.slice(0, MAX);

      busy = true;
      input.value = '';
      updateCount();
      var mine = generation;

      /* Answers arrive whole. The wait shows what is happening, and
         nothing pretends to type. */
      var turnEl = append(
        '<div class="ha-q"><p class="ha-kicker">You asked</p><p class="ha-q-text">' + esc(q) + '</p></div>' +
        '<div class="ha-a ha-pending" aria-busy="true">' +
          '<div class="ha-sec-head"><span class="ha-sec-h"><span class="ha-spin" aria-hidden="true"></span>' +
            'Searching HEAL-AI’s material…</span></div>' +
          '<div class="ha-skel-row" aria-hidden="true"><i></i><i></i><i></i></div>' +
          '<div class="ha-skel-lines" aria-hidden="true"><i></i><i></i><i></i></div>' +
        '</div>', 'ha-turn');
      var msg = turnEl.querySelector('.ha-a');
      scrollToTurn(turnEl);
      announce('Searching HEAL-AI’s material…');

      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q })
      })
        .then(function (r) {
          return r.json().catch(function () { return {}; }).then(function (body) {
            if (!r.ok) {
              var e = new Error(body.error || 'The assistant is unavailable right now.');
              e.status = r.status;
              throw e;
            }
            return body;
          });
        })
        .then(function (data) {
          if (mine !== generation) return;
          /* An answer arrived, so the service is up: clear any outage
             banner and fetch the real privacy notice if it was missed. */
          service.hidden = true;
          checkHealth();
          render(msg, data);
        })
        .catch(function (err) {
          if (mine !== generation) return;
          renderError(msg, err, q);
          healthChecked = false;
          checkHealth();
        })
        .then(function () {
          if (mine !== generation) return;
          busy = false;
          updateCount();
        });
    }

    form.addEventListener('submit', function (e) { e.preventDefault(); ask(input.value); });
    input.addEventListener('input', updateCount);
    input.addEventListener('keydown', function (e) {
      // Enter sends; Shift+Enter makes a new line. Not while an input
      // method is composing, or Enter would send half a word.
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); ask(input.value); }
    });

    updateCount();

    return {
      open: function () { open(); },
      minimise: minimise,
      close: close,
      ask: function (q) { open({ focus: false }); ask(q); }
    };
  }

  function init() {
    var first = null;
    document.querySelectorAll('[data-heal-ai-assistant]').forEach(function (el) {
      var api = mount(el);
      if (api && !first) first = api;
    });
    if (first && !window.HealAIAssistant) window.HealAIAssistant = first;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
