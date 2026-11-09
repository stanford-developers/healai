/* ─────────────────────────────────────────────────────────────────────────
   VENDORED FILE — DO NOT EDIT HERE
─────────────────────────────────────────────────────────────────────────────
   Copied from the assistant repo, which is where it is developed and
   tested:

     repo    stanford-developers/Heal-ai-bot  (~/Desktop/heal-ai-assistant)
     path    widget/heal-ai-assistant.js
     commit  211bad5f
     copied  2026-11-09

   It lives here because the website is a static GitHub Pages site and can
   only serve files that are in this repository. Edits belong upstream; a
   fix made here is lost the next time the file is re-copied.

   To see whether this copy has drifted from upstream:
     git -C ~/Desktop/heal-ai-assistant show 211bad5f:widget/heal-ai-assistant.js \
       | diff - js/heal-ai-assistant.js
─────────────────────────────────────────────────────────────────────────── */

/*
═════════════════════════════════════════════════════════════════════════
 HEAL-AI · widget/heal-ai-assistant.js
─────────────────────────────────────────────────────────────────────────
 The assistant panel on the website. Vanilla, no build step, no
 dependencies — the site has none and this should not be the reason it
 acquires one.

 It knows one endpoint and nothing else. There is no model name in here,
 no key, no provider: the page posts a question to our own server and
 renders what comes back. That is the whole point of the server existing.

 Usage:
   <div data-heal-ai-assistant data-endpoint="/api/ask"></div>
   <script src="heal-ai-assistant.js" defer></script>
═════════════════════════════════════════════════════════════════════════
*/

(function () {
  'use strict';

  var MAX = 500;  // must match LIMITS.maxQuestionChars on the server

  var NOTE =
    'Answers come only from HEAL-AI’s published material, with the ' +
    'sources shown. This is not medical, legal or clinical advice, and it ' +
    'cannot speak to an individual case.';

  /* Escapes text before it goes anywhere near innerHTML. The answer comes
     from a model, which means it is untrusted text that may contain
     anything; rendering it raw would be an injection waiting to happen. */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* Turns [1] into a button that jumps to source 1. Runs on text that is
     already escaped, so the only markup it can produce is its own. */
  function linkCitations(escaped, max) {
    return escaped.replace(/\[(\d+)\]/g, function (whole, n) {
      var i = parseInt(n, 10);
      if (i < 1 || i > max) return whole;   // out of range: show it, plainly
      return '<button type="button" class="ha-cite" data-to="' + i +
             '" aria-label="Jump to source ' + i + '">' + i + '</button>';
    });
  }

  function mount(root) {
    var endpoint = root.getAttribute('data-endpoint') || '/api/ask';
    var busy = false;

    root.classList.add('ha-assistant');
    root.innerHTML =
      '<form class="ha-form">' +
        '<label class="ha-sr-only" for="ha-q">Ask a question about HEAL-AI’s work</label>' +
        '<textarea id="ha-q" class="ha-input" rows="1" maxlength="' + MAX + '" ' +
          'placeholder="Ask about HEAL-AI’s published work…"></textarea>' +
        '<button type="submit" class="ha-send">Ask</button>' +
      '</form>' +
      '<div class="ha-count" aria-hidden="true"></div>' +
      '<div class="ha-panel" hidden aria-live="polite" aria-busy="false"></div>' +
      '<p class="ha-note">' + esc(NOTE) + '</p>';

    var form  = root.querySelector('.ha-form');
    var input = root.querySelector('.ha-input');
    var send  = root.querySelector('.ha-send');
    var count = root.querySelector('.ha-count');
    var panel = root.querySelector('.ha-panel');

    function updateCount() {
      var n = input.value.length;
      count.textContent = n ? n + ' / ' + MAX : '';
      count.setAttribute('data-over', String(n >= MAX));
      // Collapse first so scrollHeight reports the content, not the
      // box we last grew it to. The scrollbar is hidden until the box
      // actually stops growing, otherwise sub-pixel rounding leaves a
      // phantom one on a single line of text.
      input.style.height = 'auto';
      var want = input.scrollHeight;
      input.style.overflowY = want > 160 ? 'auto' : 'hidden';
      input.style.height = Math.min(want, 160) + 'px';
    }

    function show(html, opts) {
      panel.hidden = false;
      panel.setAttribute('aria-busy', (opts && opts.busy) ? 'true' : 'false');
      panel.innerHTML = html;
    }

    function render(data) {
      var sources = data.sources || [];
      var html = '<p class="ha-answer">' +
                 linkCitations(esc(data.answer || ''), sources.length) +
                 '</p>';

      if (sources.length) {
        html += '<div class="ha-sources"><div class="ha-sources-label">Sources</div><ul class="ha-source-list">';
        sources.forEach(function (s) {
          html += '<li class="ha-source" id="ha-src-' + s.n + '" data-cited="' + !!s.cited + '">' +
                    '<span class="ha-source-n">[' + s.n + ']</span>' +
                    '<span>' + esc(s.label) + '</span>' +
                  '</li>';
        });
        html += '</ul></div>';
      }

      /* If the server says the answer broke its own citation contract,
         say so on the page. Quietly rendering a malformed citation is
         how a wrong answer passes for a checked one. */
      if (data.contract_ok === false) {
        html += '<div class="ha-warn">This answer did not satisfy the citation rules — treat it with care.</div>';
      }

      show(html);

      panel.querySelectorAll('.ha-cite').forEach(function (b) {
        b.addEventListener('click', function () {
          var el = panel.querySelector('#ha-src-' + b.getAttribute('data-to'));
          if (!el) return;
          panel.querySelectorAll('.ha-source').forEach(function (s) { s.classList.remove('is-target'); });
          el.classList.add('is-target');
          el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        });
      });
    }

    function submit(e) {
      if (e) e.preventDefault();
      var q = input.value.trim();
      if (!q || busy) return;

      busy = true;
      send.disabled = true;
      show('<div class="ha-status"><span class="ha-dot"></span>Searching HEAL-AI’s material…</div>', { busy: true });

      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      })
        .then(function (r) {
          return r.json().catch(function () { return {}; }).then(function (body) {
            if (!r.ok) throw new Error(body.error || 'The assistant is unavailable right now.');
            return body;
          });
        })
        .then(render)
        .catch(function (err) {
          show('<div class="ha-error">' + esc(err.message) + '</div>');
        })
        .then(function () {
          busy = false;
          send.disabled = false;
        });
    }

    form.addEventListener('submit', submit);
    input.addEventListener('input', updateCount);
    input.addEventListener('keydown', function (e) {
      // Enter sends; Shift+Enter makes a new line. Matches what people
      // expect from every other box like this.
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
    });

    updateCount();
  }

  function init() {
    document.querySelectorAll('[data-heal-ai-assistant]').forEach(mount);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
