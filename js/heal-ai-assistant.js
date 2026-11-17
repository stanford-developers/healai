/* ─────────────────────────────────────────────────────────────────────────
   VENDORED FILE — DO NOT EDIT HERE
─────────────────────────────────────────────────────────────────────────────
   Copied from the assistant repo, which is where it is developed and
   tested:

     repo    stanford-developers/Heal-ai-bot  (~/Desktop/heal-ai-assistant)
     path    widget/heal-ai-assistant.js
     commit  5e4739d (branch main)
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
  var SUBTITLE = 'Beta · Answers from published material';

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

  var ICON = {
    chat: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.2 3.6A.5.5 0 0 1 5 19.2V16h-.5A.5.5 0 0 1 4 15.5z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M8.5 8.5h7M8.5 11.5h4.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    minus: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 12h12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M7 7l10 10M17 7L7 17" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    send: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 19V5M6 11l6-6 6 6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    out: '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M14 5h5v5M19 5l-8 8M17 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };

  /* Escapes text before it goes anywhere near innerHTML. The answer comes
     from a model, which means it is untrusted text that may contain
     anything; rendering it raw would be an injection waiting to happen. */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* Turns [1] into a button that jumps to source 1 of THIS answer. Runs
     on text that is already escaped, so the only markup it can produce
     is its own. */
  function linkCitations(escaped, max) {
    /* [1], and lists such as [1,3,4] or [1, 3], which some models write.
       Out of range: shown plainly, never linked. With max 0 (a reply that
       is not an answer) nothing is linked at all. */
    return escaped.replace(/\[(\d+(?:\s*,\s*\d+)*)\]/g, function (whole, list) {
      var nums = list.split(/\s*,\s*/).map(function (n) { return parseInt(n, 10); });
      if (!nums.every(function (i) { return i >= 1 && i <= max; })) return whole;
      return nums.map(function (i) {
        return '<button type="button" class="ha-cite" data-to="' + i +
               '" aria-label="Source ' + i + '">' + i + '</button>';
      }).join('');
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

    root.classList.add('ha-assistant');
    root.innerHTML =
      '<button type="button" class="ha-launcher" aria-expanded="false" aria-controls="' + id + '-win">' +
        ICON.chat + '<span class="ha-launcher-text">Ask a question</span>' +
        '<span class="ha-unread" hidden><span class="ha-sr-only">, new answer</span></span>' +
      '</button>' +
      '<section class="ha-window" id="' + id + '-win" role="dialog" aria-modal="false" ' +
        'aria-labelledby="' + id + '-title" aria-describedby="' + id + '-sub" hidden>' +
        '<header class="ha-head">' +
          '<div class="ha-head-text">' +
            '<h2 class="ha-title" id="' + id + '-title">' + esc(TITLE) + '</h2>' +
            '<p class="ha-sub" id="' + id + '-sub">' + esc(SUBTITLE) + '</p>' +
          '</div>' +
          '<div class="ha-head-actions">' +
            '<button type="button" class="ha-icon-btn ha-min" aria-label="Minimise (keeps this conversation)" title="Minimise">' + ICON.minus + '</button>' +
            '<button type="button" class="ha-icon-btn ha-close" aria-label="Close and clear this conversation" title="Close and clear">' + ICON.close + '</button>' +
          '</div>' +
        '</header>' +
        '<div class="ha-service" role="status" hidden></div>' +
        '<div class="ha-log" role="log" aria-live="polite" aria-label="Conversation" tabindex="0"></div>' +
        '<form class="ha-form" novalidate>' +
          '<label class="ha-sr-only" for="' + id + '-q">Ask a question about HEAL-AI’s work</label>' +
          '<textarea id="' + id + '-q" class="ha-input" rows="1" maxlength="' + MAX + '" ' +
            'placeholder="Ask about HEAL-AI’s work…" aria-describedby="' + id + '-count"></textarea>' +
          '<button type="submit" class="ha-send" aria-label="Send question">' + ICON.send + '</button>' +
        '</form>' +
        '<div class="ha-count" id="' + id + '-count"></div>' +
        '<footer class="ha-foot">' +
          '<p class="ha-note ha-line">' +
            '<span>' + esc(LINE_HEAD) + '<span class="ha-saved">' + esc(SAVED_UNKNOWN) + '</span></span>' +
            '<button type="button" class="ha-more" aria-expanded="false" aria-controls="' + id + '-notice">Details</button>' +
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
    more.addEventListener('click', function () {
      var open = more.getAttribute('aria-expanded') !== 'true';
      more.setAttribute('aria-expanded', String(open));
      more.textContent = open ? 'Hide' : 'Details';
      notice.hidden = !open;
    });

    function intro() {
      log.innerHTML =
        '<div class="ha-intro">' +
          '<p class="ha-intro-lede">Ask about the playbook, the ethics assessments, the templates or the patient panel. ' +
          'Each answer shows which documents it came from.</p>' +
          '<p class="ha-intro-small">Each question is answered on its own; earlier ones are not remembered.</p>' +
          '<div class="ha-starters" role="group" aria-label="Example questions">' +
            STARTERS.map(function (q) {
              return '<button type="button" class="ha-starter">' + esc(q) + '</button>';
            }).join('') +
          '</div>' +
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
      input.style.overflowY = want > 120 ? 'auto' : 'hidden';
      input.style.height = Math.min(want, 120) + 'px';
      send.disabled = busy || !input.value.trim();
    }

    /* ── open, minimise, close ─────────────────────────────────────── */

    var hideTimer = null;
    function isOpen() { return root.getAttribute('data-open') === 'true'; }

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
      checkHealth();
      if (!opts || opts.focus !== false) {
        setTimeout(function () { input.focus({ preventScroll: true }); }, reducedMotion() ? 0 : 60);
      }
    }

    function hide() {
      root.setAttribute('data-open', 'false');
      launcher.setAttribute('aria-expanded', 'false');
      hideTimer = setTimeout(function () { win.hidden = true; }, reducedMotion() ? 0 : 220);
      launcher.focus({ preventScroll: true });
    }

    function minimise() { hide(); }

    function close() {
      generation++;              // any reply still in flight is now stale
      busy = false;
      input.value = '';
      updateCount();
      hide();
      log.innerHTML = '';
    }

    launcher.addEventListener('click', function () { if (isOpen()) minimise(); else open(); });
    root.querySelector('.ha-min').addEventListener('click', minimise);
    root.querySelector('.ha-close').addEventListener('click', close);
    win.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); minimise(); }
    });

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

    /* ── rendering an answer ───────────────────────────────────────── */

    /* The prompt asks for two or three sentences, then an optional list
       of issues written as "- " lines. Rendered here as paragraphs and
       a real <ul>: a hyphen at the start of a line is a list to a
       sighted reader and nothing at all to a screen reader. */
    function renderAnswer(text, max) {
      var out = '', bullets = [];
      function flush() {
        if (!bullets.length) return;
        out += '<ul class="ha-points">' + bullets.join('') + '</ul>';
        bullets = [];
      }
      String(text).split('\n').forEach(function (raw) {
        var line = raw.trim();
        if (!line) { flush(); return; }
        var m = line.match(/^[-•*]\s+(.*)$/);
        if (m) bullets.push('<li>' + linkCitations(esc(m[1]), max) + '</li>');
        else { flush(); out += '<p class="ha-para">' + linkCitations(esc(line), max) + '</p>'; }
      });
      flush();
      return out;
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

    function render(msg, data) {
      var t = ++turn;
      var sources = data.sources || [];
      var kind = kindOf(data);
      var html = '';

      if (kind.label || data.stub) {
        html += '<div class="ha-tags">' +
          (kind.label ? '<span class="ha-tag ha-tag-' + kind.k + '">' + esc(kind.label) + '</span>' : '') +
          /* Only ever true against a server with no model configured:
             local development. Said on the answer so a screenshot of a
             fixture cannot pass for a real reply. */
          (data.stub ? '<span class="ha-tag ha-tag-dev">Development fixture — not a real answer</span>' : '') +
        '</div>';
      }

      /* Sources and citations belong to an answer. A refusal, a declined
         question, a withheld answer or limited service shows none: listing
         documents under "I can't answer that" reads as if they were the
         answer, or as if the assistant were hinting at one. */
      var showSources = kind.k === 'answer' && sources.length > 0;
      html += '<div class="ha-answer">' + renderAnswer(data.answer || '', showSources ? sources.length : 0) + '</div>';

      /* Not covered: say where a person can help, as the V1 plan asks. */
      if (kind.k === 'declined') {
        html += '<p class="ha-next">Not covered here? <a href="' + esc(CONTACT_HREF) + '">Contact the HEAL-AI team</a> ' +
                'or browse the reports and resources in the <a href="' + esc(TOOLKIT_HREF) + '">Toolkit</a>.</p>';
      }

      if (showSources) {
        html += '<div class="ha-sources"><h3 class="ha-sources-label">Sources</h3><ol class="ha-source-list">';
        sources.forEach(function (s) {
          var link = safeLink(s.href);
          var name = esc(s.label || 'Source ' + s.n);
          var inner = link
            ? '<a class="ha-src-link" href="' + esc(link.href) + '"' +
                (link.external ? ' target="_blank" rel="noopener noreferrer"' : '') + '>' + name +
                (link.external ? ICON.out + '<span class="ha-sr-only"> (opens in a new tab)</span>' : '') + '</a>'
            : '<span class="ha-src-text">' + name + '</span>';
          // Say what the link actually does. Sending somebody to a list
          // of reports while implying a paragraph is worse than saying so.
          var note = '';
          if (s.precision === 'section-list') note = 'Opens the list of reports';
          else if (s.precision === 'document-pending') {
            note = /^#reports\b/.test(s.href || '') ? 'Opens in Sample Reports' : 'Opens the page that lists it';
          }
          html += '<li class="ha-source" id="' + id + '-t' + t + '-src-' + s.n + '" tabindex="-1" data-cited="' + !!s.cited + '">' +
                    '<span class="ha-source-n" aria-hidden="true">' + s.n + '</span>' +
                    '<span class="ha-source-body">' + inner +
                      (note ? '<span class="ha-src-note">' + note + '</span>' : '') +
                      (s.cited ? '<span class="ha-sr-only"> — cited in the answer</span>' : '') +
                    '</span>' +
                  '</li>';
        });
        html += '</ol></div>';
      }

      /* A rating on every reply that carries an exchange id, refusals
         included: a fair question that was refused has no other way
         to be reported, and over-blocking is the failure nobody sees. */
      if (data.exchange) {
        var rl = id + '-t' + t + '-rl';
        html += '<div class="ha-rate" data-exchange="' + esc(data.exchange) + '">' +
                  '<span class="ha-rate-label" id="' + rl + '">Was this useful?</span>' +
                  '<button type="button" class="ha-thumb" data-verdict="up" aria-describedby="' + rl + '">Yes</button>' +
                  '<button type="button" class="ha-thumb" data-verdict="down" aria-describedby="' + rl + '">No</button>' +
                '</div>';
      }

      msg.removeAttribute('aria-busy');
      msg.className = 'ha-msg ha-msg-bot ha-kind-' + kind.k;
      msg.innerHTML = html;

      var rate = msg.querySelector('.ha-rate');
      if (rate) wireRating(rate);

      msg.querySelectorAll('.ha-cite').forEach(function (b) {
        b.addEventListener('click', function () {
          var el = document.getElementById(id + '-t' + t + '-src-' + b.getAttribute('data-to'));
          if (!el) return;
          msg.querySelectorAll('.ha-source').forEach(function (s) { s.classList.remove('is-target'); });
          el.classList.add('is-target');
          el.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
          el.focus({ preventScroll: true });
        });
      });

      // Start the reader at the top of the answer, not the bottom of
      // the source list.
      log.scrollTop = Math.max(0, msg.offsetTop - 8);
      if (!isOpen()) unread.hidden = false;
    }

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
        rate.innerHTML = '<span class="ha-rate-done" role="status">Sending…</span>';
        p.then(function () {
          rate.innerHTML = '<span class="ha-rate-done" role="status">' + esc(okMsg) + '</span>';
        }).catch(function () {
          rate.innerHTML = '<span class="ha-rate-done ha-rate-failed" role="status">Your rating could not be sent.</span>';
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

    function ask(question) {
      var q = String(question || '').trim();
      if (!q || busy) return;
      if (!isOpen()) open({ focus: false });
      if (q.length > MAX) q = q.slice(0, MAX);

      busy = true;
      input.value = '';
      updateCount();
      var mine = generation;

      append('<span class="ha-sr-only">You asked: </span><p class="ha-bubble">' + esc(q) + '</p>', 'ha-msg ha-msg-user');
      var msg = append(
        '<div class="ha-status"><span class="ha-dots" aria-hidden="true"><i></i><i></i><i></i></span>' +
        'Searching HEAL-AI’s material…</div>', 'ha-msg ha-msg-bot ha-pending');
      msg.setAttribute('aria-busy', 'true');
      log.scrollTop = log.scrollHeight;

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
          /* A network failure has no message worth showing: "Failed to
             fetch" is the browser's words, not the reader's. */
          var text = err.status ? err.message
            : 'The assistant could not be reached. Check your connection and try again.';
          msg.removeAttribute('aria-busy');
          msg.className = 'ha-msg ha-msg-bot ha-kind-error';
          msg.innerHTML = '<div class="ha-error" role="alert"><p>' + esc(text) + '</p>' +
            '<button type="button" class="ha-retry">Try again</button></div>';
          msg.querySelector('.ha-retry').addEventListener('click', function () {
            var mineUser = msg.previousElementSibling;
            if (mineUser) mineUser.remove();
            msg.remove();
            ask(q);
          });
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
