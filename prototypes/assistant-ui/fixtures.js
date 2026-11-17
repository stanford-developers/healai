/* ─────────────────────────────────────────────────────────────────────────
   HEAL-AI assistant · UI prototypes · shared mock data
─────────────────────────────────────────────────────────────────────────────
   PROTOTYPE ONLY. Nothing here talks to a server, a model or AWS.

   Every reply below has the same shape the real backend sends
   (~/Desktop/heal-ai-assistant/deployment/handler.mjs and
   server/server.mjs), so a design built on these fixtures can be wired to
   the real endpoint later without changing what it reads:

     answer                 the text. Paragraphs, then optional "- " bullets,
                            with citations written [1] or [1,3]
     sources[]              { n, label, href, precision, doc_id, cited }
                            (the real field is `href`, not `url`)
     refused                true for any reply that is not an answer
     refused_before_model   true when a guard stopped it before the model
     blocked_by             which guard: 'clinical_intent', 'generation_paused'…
     withheld               the answer failed the checks and is not shown
     degraded               limited service (generation paused)
     exchange               id used when rating the reply

   The answer text and findings are SAMPLE WORDING written for the
   prototype. They are not real HEAL-AI findings and must never be
   presented as such. Each prototype labels itself "mock replies".

   Use:
     HEALAI_MOCK.ask(question)        → Promise<{ ok, status, body }>
                                        rejects with a TypeError on the
                                        simulated network failure
     HEALAI_MOCK.feedback(payload)    → Promise<{ ok, status }>
     HEALAI_MOCK.health()             → Promise<{ logging_questions, log_days, notice }>
     HEALAI_MOCK.scenarios            every reply type, in a sensible order
     HEALAI_MOCK.starters             the four starter questions
     HEALAI_MOCK.next(id)             force the next ask() to return scenario `id`
     HEALAI_MOCK.kindOf(body)         { k, label } — same rule as the live widget
     HEALAI_MOCK.showsSources(body)   true only for an actual answer with sources
     HEALAI_MOCK.esc(text)            HTML-escape
     HEALAI_MOCK.reducedMotion()      prefers-reduced-motion
     HEALAI_MOCK.delay                ms to wait before a reply (0 with ?fast)
─────────────────────────────────────────────────────────────────────────── */

(function () {
  'use strict';

  var CONTACT_HREF = '#about';
  var TOOLKIT_HREF = '#toolkit';

  /* Real wording, copied from the assistant repository. */
  var CLINICAL_REFUSAL =
    'I cannot give medical advice, and nothing I have access to can. ' +
    'HEAL-AI publishes ethics assessments of AI tools used by health ' +
    'systems; the material is about those tools, not about any one ' +
    'person’s care. Please speak to a clinician. If this is urgent, ' +
    'contact emergency services.';
  var EMPTY_RETRIEVAL_ANSWER = 'The HEAL-AI material I have does not cover that.';
  var CONTRACT_FAILURE_ANSWER =
    'I could not produce an answer I can stand behind for this question, ' +
    'so I am not showing one. What came back did not pass the checks this ' +
    'assistant is held to. You can browse HEAL-AI’s reports and ' +
    'resources in the Toolkit.';
  var PAUSED_ANSWER =
    'Generated answers are temporarily paused. You can browse HEAL-AI’s ' +
    'reports and resources in the Toolkit.';
  var RATE_LIMIT =
    'Too many questions from your network just now. Please wait a minute and try again.';
  var VISITOR_NOTICE =
    'Questions are kept for 30 days to improve the assistant, with obvious ' +
    'identifiers removed automatically. Please do not type patient details ' +
    'or anything confidential.';
  var NOTE =
    'Beta: AI-generated answers can be inaccurate. Check the linked original sources. ' +
    'Not medical, legal or clinical advice.';

  var STARTERS = [
    'What did the ambient scribe assessment find?',
    'How does the ethics team run an assessment?',
    'What concerns come up most often across the reports?',
    'Which tools has HEAL-AI assessed so far?'
  ];

  /* Retrieval hits that a non-answer still carries. The live server sends
     sources with a decline, a withheld answer and limited service; the
     widget must NOT show them. They are here so a prototype that forgets
     the rule shows the bug. */
  var HITS = [
    { n: 1, label: 'Playbook 01: Ethics Team Process — Scoping an assessment', href: '#playbook-ethics-team', precision: 'document', doc_id: 'playbook-ethics-team', cited: false },
    { n: 2, label: 'Protocol for an Ethics Assessment', href: '#resources-interviews', precision: 'section-list', doc_id: 'sb-resource-protocol-for-an-ethics-assessment', cited: false },
    { n: 3, label: 'Ethics report: Horizon — Summary of concerns', href: '#reports', precision: 'document-pending', doc_id: 'sb-report-horizon', cited: false }
  ];

  var SCENARIOS = [
    {
      id: 'answer',
      label: 'Answer with sources',
      question: 'What did the ambient scribe assessment find?',
      status: 200,
      body: {
        exchange: 'a1f3c9d2e4b56789',
        refused: false, refused_before_model: false, withheld: false, degraded: false,
        answer:
          'The assessment found that clinicians valued the time the scribe saved on notes, ' +
          'but that consent and the accuracy of draft notes needed clear safeguards [1]. ' +
          'Patient partners asked to be told plainly when a visit is being recorded [2].\n' +
          '- Patients should hear about recording before it starts, and be able to say no [1,2].\n' +
          '- Draft notes need clinician review; missing details worried reviewers more than outright errors [1,3].\n' +
          '- Performance with accents and interpreters should be monitored after go-live [3].',
        sources: [
          { n: 1, label: 'Ethics report: Scribe — Consent and transparency', href: '#reports', precision: 'document-pending', doc_id: 'sb-report-scribe', cited: true },
          { n: 2, label: 'Playbook 01: Ethics Team Process — Patient Partner Panel', href: '#playbook-ethics-team', precision: 'document', doc_id: 'playbook-ethics-team', cited: true },
          { n: 3, label: 'Sample ethics report 06 — Monitoring after deployment', href: '#reports-06', precision: 'document', doc_id: 'report-06', cited: true },
          { n: 4, label: 'Protocol for an Ethics Assessment', href: '#resources-interviews', precision: 'section-list', doc_id: 'sb-resource-protocol-for-an-ethics-assessment', cited: false }
        ]
      }
    },
    {
      id: 'answer-short',
      label: 'Short answer',
      question: 'How does the ethics team run an assessment?',
      status: 200,
      body: {
        exchange: 'b2e4d0a1f3c56781',
        refused: false, refused_before_model: false, withheld: false, degraded: false,
        answer:
          'An assessment starts with scoping: the team agrees which tool, which use and which ' +
          'questions matter most [1]. It then interviews clinicians, patients and the vendor, ' +
          'and writes up the themes as a report for the FURM review [1,2].',
        sources: [
          { n: 1, label: 'Playbook 01: Ethics Team Process — Scoping an assessment', href: '#playbook-ethics-team', precision: 'document', doc_id: 'playbook-ethics-team', cited: true },
          { n: 2, label: 'Protocol for an Ethics Assessment', href: '#resources-interviews', precision: 'section-list', doc_id: 'sb-resource-protocol-for-an-ethics-assessment', cited: true }
        ]
      }
    },
    {
      id: 'clinical',
      label: 'Clinical refusal',
      question: 'Should I stop taking my blood pressure medicine before surgery?',
      status: 200,
      body: {
        exchange: 'c3f5e1b2a4d67892',
        refused: true, refused_before_model: true, blocked_by: 'clinical_intent',
        withheld: false, degraded: false,
        answer: CLINICAL_REFUSAL,
        sources: []
      }
    },
    {
      id: 'declined',
      label: 'Not covered',
      question: 'What does HEAL-AI think about self-driving cars?',
      status: 200,
      body: {
        exchange: 'd4a6f2c3b5e78903',
        refused: true, refused_before_model: false, withheld: false, degraded: false,
        answer: EMPTY_RETRIEVAL_ANSWER,
        sources: HITS
      }
    },
    {
      id: 'withheld',
      label: 'Answer withheld',
      question: 'Compare every vendor HEAL-AI has assessed and rank them.',
      status: 200,
      body: {
        exchange: 'e5b7a3d4c6f89014',
        refused: true, refused_before_model: false, withheld: true, degraded: false,
        answer: CONTRACT_FAILURE_ANSWER,
        sources: HITS
      }
    },
    {
      id: 'limited',
      label: 'Limited service',
      question: 'What concerns come up most often across the reports?',
      status: 200,
      body: {
        exchange: 'f6c8b4e5d7a90125',
        refused: true, refused_before_model: true, degraded: true, blocked_by: 'generation_paused',
        withheld: false,
        answer: PAUSED_ANSWER,
        sources: HITS
      }
    },
    {
      id: 'ratelimit',
      label: 'Rate limit',
      question: 'List every report HEAL-AI has published.',
      status: 429,
      body: { error: RATE_LIMIT }
    },
    {
      id: 'network',
      label: 'Network error',
      question: 'Who sits on the Patient Partner Panel?',
      network: true
    }
  ];

  var byId = {};
  SCENARIOS.forEach(function (s) { byId[s.id] = s; });

  /* Starter questions go to the reply types that show the most. */
  var ROUTES = {};
  ROUTES[STARTERS[0]] = 'answer';
  ROUTES[STARTERS[1]] = 'answer-short';
  ROUTES[STARTERS[2]] = 'answer';
  ROUTES[STARTERS[3]] = 'answer-short';
  SCENARIOS.forEach(function (s) { ROUTES[s.question] = s.id; });

  function route(q) {
    if (ROUTES[q]) return ROUTES[q];
    var t = q.toLowerCase();
    if (/\b(i|my|me)\b.*\b(medic|dose|pill|symptom|pain|diagnos|surgery|treat)/.test(t) ||
        /\bshould i\b/.test(t)) return 'clinical';
    if (/rank|best vendor|which is better/.test(t)) return 'withheld';
    if (/scribe|consent|patient partner|assessment|furm|report|playbook|template/.test(t)) return 'answer';
    return 'declined';
  }

  var forced = null;
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  var params = new URLSearchParams(window.location.search);
  var DELAY = params.has('fast') ? 0 : 900;

  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /* An error happens once per question: "Try again" then gets a real
     reply, as it usually would. A forced scenario always plays. */
  var failedOnce = {};
  function ask(question) {
    var q = String(question || '').trim();
    var id = forced || route(q);
    if (!forced && failedOnce[q]) id = 'answer-short';
    else if (id === 'ratelimit' || id === 'network') failedOnce[q] = true;
    forced = null;
    var s = byId[id];
    return wait(MOCK.delay).then(function () {
      if (s.network) throw new TypeError('Failed to fetch');
      var body = clone(s.body);
      /* A fresh id per reply, as the server gives. */
      if (body.exchange) body.exchange = body.exchange.slice(0, 12) + ('000' + (++seq)).slice(-4);
      return { ok: s.status >= 200 && s.status < 300, status: s.status, body: body, scenario: s.id };
    });
  }
  var seq = 0;

  function feedback(payload) {
    return wait(MOCK.delay ? 450 : 0).then(function () {
      if (!payload || !payload.exchange) return { ok: false, status: 400 };
      return { ok: true, status: 204 };
    });
  }

  function health() {
    return wait(MOCK.delay ? 200 : 0).then(function () {
      return { ok: true, logging_questions: true, log_days: 30, notice: VISITOR_NOTICE };
    });
  }

  /* Same rule as kindOf() in js/heal-ai-assistant.js. */
  function kindOf(data) {
    if (data.degraded) return { k: 'limited', label: 'Limited service' };
    if (data.withheld) return { k: 'withheld', label: 'Answer withheld' };
    if (data.refused_before_model && data.blocked_by) return { k: 'refused', label: 'Outside what this can answer' };
    if (data.refused) return { k: 'declined', label: 'Not covered by the material' };
    return { k: 'answer', label: null };
  }

  function showsSources(data) {
    return kindOf(data).k === 'answer' && (data.sources || []).length > 0;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function reducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  var MOCK = {
    ask: ask,
    feedback: feedback,
    health: health,
    next: function (id) { if (byId[id]) forced = id; },
    scenarios: SCENARIOS,
    scenario: function (id) { return byId[id] ? clone(byId[id]) : null; },
    starters: STARTERS.slice(),
    kindOf: kindOf,
    showsSources: showsSources,
    esc: esc,
    reducedMotion: reducedMotion,
    delay: DELAY,
    copy: {
      title: 'Ask about HEAL-AI’s work',
      subtitle: 'Beta · Answers from published material',
      lineHead: 'Can be wrong · Not medical advice · ',
      saved: 'Saved 30 days',
      note: NOTE,
      privacy: VISITOR_NOTICE,
      standalone: 'Each question is answered on its own; earlier ones are not remembered.',
      contactHref: CONTACT_HREF,
      toolkitHref: TOOLKIT_HREF,
      maxQuestion: 500,
      maxComment: 300
    }
  };

  window.HEALAI_MOCK = MOCK;

  /* ?probe — for headless checks. After the page settles, writes what a
     reviewer needs into <pre id="probe"> (so `chrome --dump-dom` shows
     it): page width against the viewport, and any element that sticks
     out past the right edge. */
  if (params.has('probe')) {
    window.addEventListener('load', function () {
      setTimeout(function () {
        var vw = window.innerWidth, wide = [];
        document.querySelectorAll('body *').forEach(function (el) {
          var r = el.getBoundingClientRect();
          if (r.width && r.right > vw + 1 && wide.length < 12) {
            wide.push((el.tagName.toLowerCase()) + (el.id ? '#' + el.id : '') +
              (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : '') +
              ' right=' + Math.round(r.right));
          }
        });
        var pre = document.createElement('pre');
        pre.id = 'probe';
        pre.hidden = true;
        pre.textContent = JSON.stringify({
          innerWidth: vw,
          scrollWidth: document.documentElement.scrollWidth,
          horizontalScroll: document.documentElement.scrollWidth > vw,
          wider: wide
        });
        document.body.appendChild(pre);
      }, 2500);
    });
  }
})();
