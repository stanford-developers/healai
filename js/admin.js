/*
═════════════════════════════════════════════════════════════════════════════
 HEAL-AI · js/admin.js
─────────────────────────────────────────────────────────────────────────────
 PURPOSE
   Everything admin.html needs: auth (login/signup/logout/session), and
   the upload/publish/list/reprioritize/delete flow for every admin-
   editable content list on the site — Toolkit resources, Sample Reports,
   Team members, and News-tab items (seminar videos, news articles,
   scholarly publications). All of it talks directly to Supabase from the
   browser, there is no server code in this repo, so every permission
   check below is enforced twice: once here (for a decent user
   experience) and once server-side by Postgres Row Level Security (see
   /supabase/schema.sql, /supabase/news_schema.sql, and
   /supabase/reports_team_schema.sql), which is the check that actually
   matters for security. Never trust the client-side one alone.

 GLOBAL SCOPE
   Loaded after config.js and the Supabase CDN script, so SUPABASE_URL,
   SUPABASE_ANON_KEY, and window.supabase (the library) already exist.
═════════════════════════════════════════════════════════════════════════════
*/

function byId(id) { return document.getElementById(id); }

const sb = (SUPABASE_URL.includes('REPLACE-WITH') || !window.supabase)
  ? null
  : window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let authMode = 'login';   /* 'login' | 'signup' */

function showView(name) {
  byId('auth-view').hidden = name !== 'auth';
  byId('pending-view').hidden = name !== 'pending';
  byId('dashboard-view').hidden = name !== 'dashboard';
}

/* ── Dashboard sub-tabs: Toolkit resources / Sample Reports / Team / News ── */
const DASH_TABS = ['resources', 'reports', 'team', 'news'];
const DASH_H2   = { resources: 'Publish a resource', reports: 'Publish a report', team: 'Publish a team member', news: 'Publish a news item' };

function setDashTab(name) {
  DASH_TABS.forEach(tab => {
    byId('dash-tab-' + tab).classList.toggle('on', tab === name);
    byId('dash-tab-' + tab).setAttribute('aria-selected', tab === name);
    byId('dash-panel-' + tab).hidden = tab !== name;
  });
  /* A panel left in edit mode keeps its "Edit …" heading when you switch
     away and back, so the heading never disagrees with the form below it.
     EDIT_ROW/PANEL_FORMS are declared later in the file but this only runs
     after the whole script has evaluated. */
  byId('dash-h2').textContent = EDIT_ROW[name] ? PANEL_FORMS[name].editH2 : DASH_H2[name];
}

/* ─────────────────────────────────────────────────────────────────────────
   AUTH
   ────────────────────────────────────────────────────────────────────── */
function setAuthMode(mode) {
  authMode = mode;
  byId('auth-tab-login').classList.toggle('on', mode === 'login');
  byId('auth-tab-login').setAttribute('aria-selected', mode === 'login');
  byId('auth-tab-signup').classList.toggle('on', mode === 'signup');
  byId('auth-tab-signup').setAttribute('aria-selected', mode === 'signup');
  byId('auth-submit').textContent = mode === 'login' ? 'Log in' : 'Sign up';
  byId('auth-password').autocomplete = mode === 'login' ? 'current-password' : 'new-password';
  byId('auth-status').textContent = '';
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const email = byId('auth-email').value.trim();
  const password = byId('auth-password').value;
  const status = byId('auth-status');
  const submit = byId('auth-submit');

  submit.disabled = true;
  status.textContent = authMode === 'login' ? 'Logging in…' : 'Creating your account…';

  const { error } = authMode === 'login'
    ? await sb.auth.signInWithPassword({ email, password })
    : await sb.auth.signUp({ email, password });

  submit.disabled = false;

  if (error) {
    status.textContent = error.message;
    return;
  }
  if (authMode === 'signup') {
    status.textContent = 'Account created. If email confirmation is on, check your inbox, then come back and log in.';
  }
  /* On success, onAuthStateChange (below) handles switching views. */
}

async function handleLogout() {
  await sb.auth.signOut();
}

/**
 * Looks up whether the signed-in user is an approved admin, and shows the
 * matching view. Called once on load and every time auth state changes.
 */
async function syncViewToSession(session) {
  if (!session) { showView('auth'); return; }

  const { data: profile } = await sb
    .from('profiles')
    .select('is_admin')
    .eq('id', session.user.id)
    .single();

  if (profile && profile.is_admin) {
    byId('dash-email').textContent = session.user.email;
    showView('dashboard');
    loadResources();
    loadReports();
    loadTeamMembers();
    loadNewsItems();
  } else {
    byId('pending-email').textContent = session.user.email;
    showView('pending');
  }
}

/* ═════════════════════════════════════════════════════════════════════════
   LIST FILTERING
   ─────────────────────────────────────────────────────────────────────────
   Resources, Sample Reports, and News each get a filter bar above their
   manage list. Filtering is client-side against rows already fetched by
   that list's load function: these tables hold tens of rows, not
   thousands, so re-querying Supabase per keystroke would add latency and
   load for no benefit.

   Each load function therefore splits in two — fetch into LIST_ROWS, then
   render from it — so a filter change re-renders without a round trip. It
   also means an edit or delete refreshes the list while keeping whatever
   filter is active.

   Adding a filter to a list means: markup in admin.html, a predicate in
   LIST_FILTERS below, and the control ids in its `controls` array.
   ════════════════════════════════════════════════════════════════════════ */

/** Every row fetched for each panel, unfiltered. */
const LIST_ROWS = { resources: [], reports: [], news: [] };

function filterValue(id) {
  const el = byId(id);
  return el ? el.value.trim() : '';
}

/** Case-insensitive "does any of these fields contain the query" test. */
function matchesQuery(q, fields) {
  if (!q) return true;
  const needle = q.toLowerCase();
  return fields.some(f => String(f || '').toLowerCase().includes(needle));
}

/** Which of the four link states a resource row is in — the same
 *  distinction resourceTargetLabel() renders, kept in one place so the
 *  filter and the label can't disagree. */
function resourceLinkState(r) {
  if (r.link_url === '#') return 'placeholder';
  if (r.link_url)         return 'link';
  if (r.file_path)        return 'file';
  return 'soon';
}

const LIST_FILTERS = {
  resources: {
    controls: ['resource-filter-q', 'resource-filter-category', 'resource-filter-icon', 'resource-filter-state'],
    clear: 'resource-filter-clear',
    count: 'resource-filter-count',
    noun: 'resource',
    render: () => renderResourceList(),
    active: () => !!(filterValue('resource-filter-q') || filterValue('resource-filter-category')
                  || filterValue('resource-filter-icon') || filterValue('resource-filter-state')),
    match: r =>
      matchesQuery(filterValue('resource-filter-q'), [r.title, r.description])
      && (!filterValue('resource-filter-category') || r.category === filterValue('resource-filter-category'))
      && (!filterValue('resource-filter-icon')     || (r.icon || 'paper') === filterValue('resource-filter-icon'))
      && (!filterValue('resource-filter-state')    || resourceLinkState(r) === filterValue('resource-filter-state')),
  },

  reports: {
    controls: ['report-filter-q', 'report-filter-file'],
    clear: 'report-filter-clear',
    count: 'report-filter-count',
    noun: 'report',
    render: () => renderReportList(),
    active: () => !!(filterValue('report-filter-q') || filterValue('report-filter-file')),
    match: r => {
      const wantFile = filterValue('report-filter-file');
      return matchesQuery(filterValue('report-filter-q'), [r.name, r.sub])
        && (!wantFile || (wantFile === 'yes' ? !!r.file_path : !r.file_path));
    },
  },

  news: {
    controls: ['news-filter-q', 'news-filter-type', 'news-filter-year'],
    clear: 'news-filter-clear',
    count: 'news-filter-count',
    noun: 'news item',
    render: () => renderNewsList(),
    active: () => !!(filterValue('news-filter-q') || filterValue('news-filter-type') || filterValue('news-filter-year')),
    match: r => {
      const m = r.meta || {};
      return matchesQuery(filterValue('news-filter-q'), [r.title, r.description, m.speaker, m.venue, m.source, m.authors, m.journal])
        && (!filterValue('news-filter-type') || r.type === filterValue('news-filter-type'))
        && (!filterValue('news-filter-year') || String(r.date || '').slice(0, 4) === filterValue('news-filter-year'));
    },
  },
};

/** The rows a panel should currently show. */
function visibleRows(panel) {
  return LIST_ROWS[panel].filter(LIST_FILTERS[panel].match);
}

/** Keeps the "Showing n of m" line and the Clear button in sync. Called by
 *  each render function, so it's correct after a filter change, an edit, or
 *  a delete alike. */
function syncFilterChrome(panel, shown) {
  const cfg = LIST_FILTERS[panel];
  const total = LIST_ROWS[panel].length;
  const on = cfg.active();
  byId(cfg.clear).hidden = !on;
  byId(cfg.count).textContent = on
    ? `Showing ${shown} of ${total} ${cfg.noun}${total === 1 ? '' : 's'}`
    : '';
}

function clearFilter(panel) {
  LIST_FILTERS[panel].controls.forEach(id => { const el = byId(id); if (el) el.value = ''; });
  LIST_FILTERS[panel].render();
}

/** Rebuilds the News year dropdown from the years actually present, keeping
 *  the current selection if it still exists. */
function syncNewsYearOptions() {
  const sel = byId('news-filter-year');
  if (!sel) return;
  const current = sel.value;
  const years = [...new Set(LIST_ROWS.news.map(r => String(r.date || '').slice(0, 4)).filter(Boolean))]
    .sort().reverse();
  sel.innerHTML = '<option value="">All years</option>'
    + years.map(y => `<option value="${y}">${y}</option>`).join('');
  if (years.includes(current)) sel.value = current;
}

function initListFilters() {
  Object.keys(LIST_FILTERS).forEach(panel => {
    const cfg = LIST_FILTERS[panel];
    cfg.controls.forEach(id => {
      const el = byId(id);
      if (!el) return;
      /* 'input' for the search box so it filters as you type; 'change' is
         enough for the selects and fires on them too. */
      el.addEventListener('input', cfg.render);
      el.addEventListener('change', cfg.render);
    });
    const clearBtn = byId(cfg.clear);
    if (clearBtn) clearBtn.addEventListener('click', () => clearFilter(panel));
  });
}


/* ═════════════════════════════════════════════════════════════════════════
   EDIT MODE
   ─────────────────────────────────────────────────────────────────────────
   All four panels reuse their publish form for editing rather than growing
   a second inline editor: clicking Edit on a row loads that row into the
   form above and flips the panel into edit mode, so its submit handler
   UPDATEs that row instead of INSERTing a new one. That keeps one set of
   field definitions, validation, and file-upload logic per panel.

   EDIT_ROW[panel] holds the row being edited, or null when the panel is in
   its normal "publish a new one" state. Each panel's submit handler reads
   it through editingRow() and finishes with finishEdit(), which resets the
   form either way.

   File fields are the one asymmetry: leaving the file input empty while
   editing means "keep the file that's already attached", so those columns
   are omitted from the UPDATE rather than written as null. Picking a new
   file replaces the old one, and the old object is deleted from Storage
   only after the row update succeeds.
   ════════════════════════════════════════════════════════════════════════ */
const EDIT_ROW = { resources: null, reports: null, team: null, news: null };

/* One entry per panel: its form, the submit button's two labels, and the
   function that loads a row's values into the fields. */
const PANEL_FORMS = {
  resources: { form: 'upload-form', submit: 'upload-submit', cancel: 'upload-cancel',
               status: 'upload-status', publishLabel: 'Publish resource',
               editH2: 'Edit a resource', fill: fillResourceForm },
  reports:   { form: 'report-form', submit: 'report-submit', cancel: 'report-cancel',
               status: 'report-status', publishLabel: 'Publish',
               editH2: 'Edit a report', fill: fillReportForm },
  team:      { form: 'team-form',   submit: 'team-submit',   cancel: 'team-cancel',
               status: 'team-status',   publishLabel: 'Publish',
               editH2: 'Edit a team member', fill: fillTeamForm },
  news:      { form: 'news-form',   submit: 'news-submit',   cancel: 'news-cancel',
               status: 'news-status',   publishLabel: 'Publish',
               editH2: 'Edit a news item', fill: fillNewsForm },
};

function editingRow(panel) { return EDIT_ROW[panel]; }

/** Loads `row` into the panel's form and switches it to edit mode. */
function startEdit(panel, row) {
  const cfg = PANEL_FORMS[panel];
  EDIT_ROW[panel] = row;

  byId(cfg.form).reset();          /* clear leftovers before filling */
  cfg.fill(row);

  byId(cfg.submit).textContent = 'Save changes';
  byId(cfg.cancel).hidden = false;
  byId(cfg.form).classList.add('admin-form-editing');
  byId('dash-h2').textContent = cfg.editH2;
  byId(cfg.status).textContent = 'Editing an existing entry. Save changes, or cancel to leave it as it was.';
  byId(cfg.form).scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/** Returns the panel to "publish a new one", discarding any edit. */
function cancelEdit(panel) {
  const cfg = PANEL_FORMS[panel];
  EDIT_ROW[panel] = null;
  byId(cfg.form).reset();
  byId(cfg.submit).textContent = cfg.publishLabel;
  byId(cfg.cancel).hidden = true;
  byId(cfg.form).classList.remove('admin-form-editing');
  byId('dash-h2').textContent = DASH_H2[panel];
  byId(cfg.status).textContent = '';
  if (panel === 'news') syncNewsFieldsToType();
}

/** Called by a submit handler after a successful save, to drop edit mode
 *  without wiping the success message cancelEdit() would clear. */
function finishEdit(panel) {
  const cfg = PANEL_FORMS[panel];
  const wasEditing = !!EDIT_ROW[panel];
  EDIT_ROW[panel] = null;
  byId(cfg.form).reset();
  byId(cfg.submit).textContent = cfg.publishLabel;
  byId(cfg.cancel).hidden = true;
  byId(cfg.form).classList.remove('admin-form-editing');
  byId('dash-h2').textContent = DASH_H2[panel];
  return wasEditing;
}

/** The Edit button markup shared by all four lists. The row's JSON rides
 *  along in a data attribute so the click handler doesn't need a second
 *  round trip to fetch what it already has. */
function editButtonHTML(panel, row) {
  const payload = encodeURIComponent(JSON.stringify(row));
  return `<button type="button" class="btn-second admin-edit-btn" data-panel="${panel}" data-row="${payload}">Edit</button>`;
}

/** Wires every Edit button inside `list`. */
function wireEditButtons(list) {
  list.querySelectorAll('.admin-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      startEdit(btn.dataset.panel, JSON.parse(decodeURIComponent(btn.dataset.row)));
    });
  });
}

/* ── Per-panel field loaders ─────────────────────────────────────────── */

function fillResourceForm(r) {
  byId('upload-title').value = r.title || '';
  byId('upload-description').value = r.description || '';
  byId('upload-category').value = r.category || 'interviews';
  byId('upload-icon').value = r.icon || 'paper';
  byId('upload-link').value = r.link_url && r.link_url !== '#' ? r.link_url : '';
  byId('upload-priority').value = r.priority ?? 0;
}

function fillReportForm(r) {
  byId('report-name').value = r.name || '';
  byId('report-sub').value = r.sub || '';
  byId('report-overview').value = r.overview || '';
  byId('report-summary').value = r.summary || '';
  byId('report-issues').value = (r.issues || []).join('\n');
  byId('report-priority').value = r.priority ?? '';
}

function fillTeamForm(m) {
  byId('team-name').value = m.name || '';
  byId('team-role').value = m.role || '';
  byId('team-badge').value = m.badge || '';
  byId('team-affiliation').value = m.affiliation || '';
  byId('team-profile').value = m.profile_url || '';
  byId('team-priority').value = m.priority ?? '';
}

function fillNewsForm(r) {
  byId('news-type').value = r.type || 'seminar_video';
  syncNewsFieldsToType();            /* reveal the fields this type uses */
  byId('news-title').value = r.title || '';
  byId('news-description').value = r.description || '';
  byId('news-date').value = r.date || '';
  byId('news-link').value = r.link || '';
  byId('news-priority').value = r.priority ?? '';
  const m = r.meta || {};
  byId('news-speaker').value = m.speaker || '';
  byId('news-venue').value   = m.venue   || '';
  byId('news-source').value  = m.source  || '';
  byId('news-authors').value = m.authors || '';
  byId('news-journal').value = m.journal || '';
  byId('news-show').value       = m.show       || '';
  byId('news-host').value       = m.host       || '';
  byId('news-embed').value      = m.embed      || '';
  byId('news-transcript').value = m.transcript || '';
  /* An absolute audio URL is editable; an uploaded path isn't shown here,
     since the field is a URL input and the file is already attached. */
  byId('news-audio-url').value =
    /^https?:\/\//i.test(m.audio || '') ? m.audio : '';
}


/* ─────────────────────────────────────────────────────────────────────────
   TOOLKIT RESOURCES — publish / edit / list / reorder / delete
   ────────────────────────────────────────────────────────────────────── */
/**
 * Publishes a new resource card, or saves changes to the one being edited.
 *
 * A card carries either an uploaded file or a link, and with neither it
 * publishes as a "Coming soon" card — so the only hard requirements are a
 * title and a category. Uploading a file while also giving a link is
 * rejected rather than silently picking one.
 *
 * When editing, an empty file input means "keep the attached file", so the
 * file columns are left out of the UPDATE. Uploading a new file replaces
 * the old object and clears link_url; otherwise the link field is
 * authoritative for link_url. A row that ends up with both keeps working —
 * getPublicResources() in app.js prefers link_url — but the form can't
 * create that state by accident.
 */
async function handleUploadSubmit(e) {
  e.preventDefault();
  const editing = editingRow('resources');
  const file = byId('upload-file').files[0];
  const link = byId('upload-link').value.trim();
  const title = byId('upload-title').value.trim();
  const description = byId('upload-description').value.trim();
  const category = byId('upload-category').value;
  const icon = byId('upload-icon').value;
  const priority = Number(byId('upload-priority').value) || 0;
  const status = byId('upload-status');
  const submit = byId('upload-submit');

  if (file && link) {
    status.textContent = 'Give a file or a link, not both — the card links to one place.';
    return;
  }

  submit.disabled = true;
  status.textContent = file ? 'Uploading…' : 'Saving…';

  const { data: { session } } = await sb.auth.getSession();
  const row = {
    title, description, category, icon, priority,
    link_url: link || null,
  };

  if (file) {
    const path = `${category}/${crypto.randomUUID()}-${file.name}`;
    const { error: uploadError } = await sb.storage.from('resource-files').upload(path, file);
    if (uploadError) {
      submit.disabled = false;
      status.textContent = 'Upload failed: ' + uploadError.message;
      return;
    }
    row.file_path = path;
    row.file_name = file.name;
    row.file_size_bytes = file.size;
  }

  const { error: saveError } = editing
    ? await sb.from('resources').update(row).eq('id', editing.id)
    : await sb.from('resources').insert({ ...row, uploaded_by: session.user.id });

  submit.disabled = false;

  if (saveError) {
    status.textContent = (file ? 'File uploaded, but saving its details failed: ' : 'Saving failed: ')
      + saveError.message;
    return;
  }

  /* Only now that the row points at the new file is the old one safe to
     remove — a failed update above would otherwise leave a card whose file
     had already been deleted. */
  if (editing && file && editing.file_path) {
    await sb.storage.from('resource-files').remove([editing.file_path]);
  }

  const wasEditing = finishEdit('resources');
  status.textContent = wasEditing ? 'Changes saved.' : (file ? 'Uploaded.' : 'Published.');
  loadResources();
}

function formatBytes(n) {
  if (!n) return '';
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return Math.round(n / 1024) + ' KB';
  return (n / (1024 * 1024)).toFixed(1) + ' MB';
}

/* Mirrors the `label` of each RESOURCE_CATEGORIES entry in js/data.js, plus
   where that category renders. admin.js can't read data.js (the dashboard
   doesn't load it), so these are duplicated deliberately — keep in sync if a
   category is renamed. */
const RESOURCE_CATEGORY_LABEL = {
  interviews: 'Stakeholder Interviews · Toolkit',
  panel:      'Patient Partner Group · Patient Panel',
  reports:    'Writing & Delivering Your Report · Toolkit',
};

/** A link shown as host + filename rather than in full: these are
 *  100+ character URLs into a Stanford media path, and printing them whole
 *  wrapped a row over four lines without telling you anything the short
 *  form doesn't. The untruncated URL stays available as a `title` tooltip —
 *  see resourceTargetTitle(). Falls back to the raw string if it won't
 *  parse as a URL. */
function shortenUrl(url) {
  try {
    const u = new URL(url);
    const last = u.pathname.split('/').filter(Boolean).pop();
    return last ? `${u.host}/…/${last}` : u.host;
  } catch {
    return url;
  }
}

/** Where a card points, in words — the public site derives the same thing
 *  from link_url/file_path, so this makes a misfiled row obvious here rather
 *  than only on the live page. */
function resourceTargetLabel(r) {
  if (r.link_url)  return r.link_url === '#' ? 'Placeholder link (#) — needs a real URL' : 'Links to ' + shortenUrl(r.link_url);
  if (r.file_path) return `${r.file_name || 'file'} · ${formatBytes(r.file_size_bytes)}`;
  return 'No file or link — shows as "Coming soon"';
}

/** Hover text for the meta line: the full URL, since resourceTargetLabel()
 *  only shows an abbreviated form. Empty for non-link rows, which drops the
 *  attribute rather than showing an empty tooltip. */
function resourceTargetTitle(r) {
  return r.link_url && r.link_url !== '#' ? r.link_url : '';
}

async function loadResources() {
  const list = byId('resource-list');
  const { data, error } = await sb
    .from('resources')
    .select('*')
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) {
    list.innerHTML = `<p class="admin-empty">Couldn't load resources: ${error.message}</p>`;
    return;
  }

  LIST_ROWS.resources = data;
  renderResourceList();
}

/** Renders the resource list from LIST_ROWS, honouring the filter bar.
 *  Split out from loadResources() so filtering re-renders without
 *  re-querying — see the LIST FILTERING block above. */
function renderResourceList() {
  const list = byId('resource-list');
  const rows = visibleRows('resources');
  syncFilterChrome('resources', rows.length);

  if (!LIST_ROWS.resources.length) {
    list.innerHTML = '<p class="admin-empty">Nothing published yet.</p>';
    return;
  }
  if (!rows.length) {
    list.innerHTML = '<p class="admin-empty">No resources match these filters.</p>';
    return;
  }

  /* Listed in the same order the public site renders them, grouped by
     category, so "which card is the big one" is answerable from here. */
  list.innerHTML = rows.map(r => `
    <div class="admin-resource-row" data-id="${r.id}">
      <div>
        <span class="admin-resource-category">${RESOURCE_CATEGORY_LABEL[r.category] || r.category}</span>
        <h4>${r.title}</h4>
        <p>${r.description || ''}</p>
        <span class="admin-resource-meta" title="${resourceTargetTitle(r)}">${r.icon || 'paper'} · ${resourceTargetLabel(r)}</span>
      </div>
      <div class="admin-news-row-actions">
        <label class="admin-priority-field">
          <span>Order</span>
          <input type="number" step="10" class="admin-priority-input" data-id="${r.id}" value="${r.priority ?? 0}">
        </label>
        ${editButtonHTML('resources', r)}
        <button type="button" class="btn-second admin-delete-btn" data-id="${r.id}" data-path="${r.file_path || ''}">Delete</button>
      </div>
    </div>
  `).join('');

  wireEditButtons(list);
  list.querySelectorAll('.admin-priority-input').forEach(input => {
    input.addEventListener('change', () => handleResourcePriorityChange(input.dataset.id, input.value));
  });
  list.querySelectorAll('.admin-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => handleDelete(btn.dataset.id, btn.dataset.path));
  });
}

/** Resources get their own priority handler rather than sharing
 *  handlePriorityChange(): `resources.priority` is NOT NULL (a blank would
 *  be rejected) and, because DESC ordering puts NULLs first in Postgres, a
 *  nullable column would float un-ordered cards to the top of a section. */
async function handleResourcePriorityChange(id, value) {
  await sb.from('resources').update({ priority: Number(value) || 0 }).eq('id', id);
  loadResources();
}

async function handleDelete(id, path) {
  if (!confirm('Delete this resource? It disappears from the public site, and any uploaded file is removed too.')) return;
  if (path) await sb.storage.from('resource-files').remove([path]);
  await sb.from('resources').delete().eq('id', id);
  loadResources();
}

/* ─────────────────────────────────────────────────────────────────────────
   NEWS — publish/list/reprioritize/delete for the News tab's 3 feeds
   (seminar_video / news_article / scholarly_publication), all stored in
   one `news_items` table (see /supabase/news_schema.sql) and
   distinguished by `type`. Type-specific fields (speaker/venue, source,
   authors/journal) live in the `meta` jsonb column.
   ────────────────────────────────────────────────────────────────────── */

/** Shows/hides the type-specific fields in the news form to match the
 *  selected type — same idea as setAuthMode() toggling login vs. signup. */
function syncNewsFieldsToType() {
  const type = byId('news-type').value;
  const show = (id, on) => { const el = byId(id); if (el) el.hidden = !on; };

  show('news-field-speaker',    type === 'seminar_video');
  show('news-field-venue',      type === 'seminar_video');
  show('news-field-embed',      type === 'seminar_video');

  show('news-field-show',       type === 'podcast');
  show('news-field-host',       type === 'podcast');
  show('news-field-audio',      type === 'podcast');
  show('news-field-audio-url',  type === 'podcast');
  show('news-field-transcript', type === 'podcast');

  show('news-field-source',     type === 'news_article');

  show('news-field-authors',    type === 'scholarly_publication');
  show('news-field-journal',    type === 'scholarly_publication');

  /* Publications render as a list, not a tile, so a thumbnail would never
     be shown for one. */
  show('news-field-thumb',      type !== 'scholarly_publication');
}

/** Reads only the meta fields relevant to `type` — an unselected type's
 *  fields are left blank in the form and shouldn't be saved as empty
 *  strings on a row they don't apply to. */
function collectNewsMeta(type) {
  if (type === 'seminar_video') {
    return {
      speaker: byId('news-speaker').value.trim(),
      venue:   byId('news-venue').value.trim(),
      embed:   byId('news-embed').value.trim(),
    };
  }
  if (type === 'podcast') {
    return {
      show:       byId('news-show').value.trim(),
      host:       byId('news-host').value.trim(),
      transcript: byId('news-transcript').value.trim(),
    };
  }
  if (type === 'news_article') {
    return { source: byId('news-source').value.trim() };
  }
  return { authors: byId('news-authors').value.trim(), journal: byId('news-journal').value.trim() };
}

/** Uploads a file to the news-media bucket and returns its storage path.
 *  Same `<uuid>-<name>` scheme as the other buckets, so two episodes named
 *  episode1.mp3 can't collide. */
async function uploadNewsMedia(file) {
  const path = `${crypto.randomUUID()}-${file.name}`;
  const { error } = await sb.storage.from('news-media').upload(path, file);
  if (error) throw new Error('Upload failed: ' + error.message);
  return path;
}

async function handleNewsSubmit(e) {
  e.preventDefault();
  const editing = editingRow('news');
  const type = byId('news-type').value;
  const title = byId('news-title').value.trim();
  const description = byId('news-description').value.trim();
  const date = byId('news-date').value;
  const link = byId('news-link').value.trim();
  const priorityRaw = byId('news-priority').value.trim();
  const status = byId('news-status');
  const submit = byId('news-submit');

  submit.disabled = true;
  status.textContent = editing ? 'Saving…' : 'Publishing…';

  const { data: { session } } = await sb.auth.getSession();
  const meta = collectNewsMeta(type);

  /* Media goes into the news-media bucket and its path into `meta`, which
     is where the public renderer looks (newsMediaUrl() in app.js resolves
     a bare path against that bucket and passes an absolute URL through).
     Uploads happen before the row write so a failure leaves nothing
     half-saved. */
  try {
    const thumbFile = byId('news-thumb').files[0];
    if (thumbFile) meta.thumb = await uploadNewsMedia(thumbFile);

    if (type === 'podcast') {
      const audioFile = byId('news-audio').files[0];
      const audioUrl  = byId('news-audio-url').value.trim();
      if (audioFile)     meta.audio = await uploadNewsMedia(audioFile);
      else if (audioUrl) meta.audio = audioUrl;
    }
  } catch (err) {
    submit.disabled = false;
    status.textContent = err.message;
    return;
  }

  /* Editing with the file inputs left empty must not wipe media already
     attached — the inputs can't be pre-filled, so an absent file means
     "keep what's there", not "remove it". */
  if (editing) {
    const prev = editing.meta || {};
    if (!meta.thumb && prev.thumb) meta.thumb = prev.thumb;
    if (type === 'podcast' && !meta.audio && prev.audio) meta.audio = prev.audio;
  }

  const row = {
    type, title, description, date,
    link: link || null,
    priority: priorityRaw === '' ? null : Number(priorityRaw),
    meta,
  };

  const { error } = editing
    ? await sb.from('news_items').update(row).eq('id', editing.id)
    : await sb.from('news_items').insert({ ...row, uploaded_by: session.user.id });

  submit.disabled = false;

  if (error) {
    status.textContent = (editing ? 'Saving failed: ' : 'Publish failed: ') + error.message;
    return;
  }

  const wasEditing = finishEdit('news');
  status.textContent = wasEditing ? 'Changes saved.' : 'Published.';
  syncNewsFieldsToType();
  loadNewsItems();
}

const NEWS_TYPE_LABEL = { seminar_video: 'Seminar video', podcast: 'Podcast episode',
                          news_article: 'News article', scholarly_publication: 'Scholarly publication' };

/** One line of type-specific meta, shown under the title — mirrors how
 *  the public News tab shows "speaker · venue" / "source" / "authors · journal". */
function newsMetaLine(r) {
  const m = r.meta || {};
  if (r.type === 'seminar_video') return [m.speaker, m.venue].filter(Boolean).join(' · ');
  if (r.type === 'podcast') {
    /* Flag what media is attached — the one thing about a podcast row you
       can't tell from its title. */
    const bits = [m.show, m.host].filter(Boolean);
    bits.push(m.audio ? 'audio attached' : 'no audio');
    if (m.transcript) bits.push('transcript');
    return bits.join(' · ');
  }
  if (r.type === 'news_article') return m.source || '';
  return [m.authors, m.journal].filter(Boolean).join(' · ');
}

async function loadNewsItems() {
  const list = byId('news-item-list');
  const { data, error } = await sb
    .from('news_items')
    .select('*')
    .order('date', { ascending: false });

  if (error) {
    list.innerHTML = `<p class="admin-empty">Couldn't load news items: ${error.message}</p>`;
    return;
  }

  LIST_ROWS.news = data;
  syncNewsYearOptions();
  renderNewsList();
}

function renderNewsList() {
  const list = byId('news-item-list');
  const rows = visibleRows('news');
  syncFilterChrome('news', rows.length);

  if (!LIST_ROWS.news.length) {
    list.innerHTML = '<p class="admin-empty">Nothing published yet.</p>';
    return;
  }
  if (!rows.length) {
    list.innerHTML = '<p class="admin-empty">No news items match these filters.</p>';
    return;
  }

  list.innerHTML = rows.map(r => `
    <div class="admin-resource-row" data-id="${r.id}">
      <div>
        <span class="admin-resource-category">${NEWS_TYPE_LABEL[r.type] || r.type}</span>
        <h4>${r.title}</h4>
        <p>${r.description || ''}</p>
        <span class="admin-resource-meta">${newsMetaLine(r)} · ${r.date}</span>
      </div>
      <div class="admin-news-row-actions">
        <label class="admin-priority-field">
          <span>Priority</span>
          <input type="number" step="1" class="admin-priority-input" data-id="${r.id}" value="${r.priority ?? ''}" placeholder="date">
        </label>
        ${editButtonHTML('news', r)}
        <button type="button" class="btn-second admin-delete-btn" data-id="${r.id}">Delete</button>
      </div>
    </div>
  `).join('');

  wireEditButtons(list);
  list.querySelectorAll('.admin-priority-input').forEach(input => {
    input.addEventListener('change', () => handlePriorityChange('news_items', input.dataset.id, input.value, loadNewsItems));
  });
  list.querySelectorAll('.admin-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => handleNewsDelete(btn.dataset.id));
  });
}

/** Shared by News/Reports/Team's priority inputs — all 3 tables have the
 *  same nullable integer `priority` column and the same "higher shows
 *  earlier, blank falls back to newest/oldest-first" semantics. */
async function handlePriorityChange(table, id, value, reload) {
  const priority = value.trim() === '' ? null : Number(value);
  await sb.from(table).update({ priority }).eq('id', id);
  reload();
}

async function handleNewsDelete(id) {
  if (!confirm('Delete this news item?')) return;
  await sb.from('news_items').delete().eq('id', id);
  loadNewsItems();
}

/* ─────────────────────────────────────────────────────────────────────────
   SAMPLE REPORTS — publish/list/reprioritize/delete for the rich sample-
   report tiles (see /supabase/reports_team_schema.sql). Same shape as the
   8 static ones in data.js: overview, summary, key issues, an optional
   uploaded file for "Download Full Report".
   ────────────────────────────────────────────────────────────────────── */
async function handleReportSubmit(e) {
  e.preventDefault();
  const name = byId('report-name').value.trim();
  const sub = byId('report-sub').value.trim();
  const overview = byId('report-overview').value.trim();
  const summary = byId('report-summary').value.trim();
  const issues = byId('report-issues').value.split('\n').map(s => s.trim()).filter(Boolean);
  const priorityRaw = byId('report-priority').value.trim();
  const file = byId('report-file').files[0];
  const status = byId('report-status');
  const submit = byId('report-submit');
  const editing = editingRow('reports');

  submit.disabled = true;
  status.textContent = editing ? 'Saving…' : 'Publishing…';

  const { data: { session } } = await sb.auth.getSession();
  const row = {
    name, sub, overview, summary, issues,
    priority: priorityRaw === '' ? null : Number(priorityRaw),
  };

  if (file) {
    const path = `${crypto.randomUUID()}-${file.name}`;
    const { error: uploadError } = await sb.storage.from('report-files').upload(path, file);
    if (uploadError) {
      submit.disabled = false;
      status.textContent = 'File upload failed: ' + uploadError.message;
      return;
    }
    row.file_path = path;
    row.file_name = file.name;
  } else if (!editing) {
    /* A brand-new report with no file attached is explicit about it; an
       edit with an empty file input keeps whatever is already attached. */
    row.file_path = null;
    row.file_name = null;
  }

  const { error } = editing
    ? await sb.from('reports').update(row).eq('id', editing.id)
    : await sb.from('reports').insert({ ...row, uploaded_by: session.user.id });

  submit.disabled = false;

  if (error) {
    status.textContent = (editing ? 'Saving failed: ' : 'Publish failed: ') + error.message;
    return;
  }

  if (editing && file && editing.file_path) {
    await sb.storage.from('report-files').remove([editing.file_path]);
  }

  const wasEditing = finishEdit('reports');
  status.textContent = wasEditing ? 'Changes saved.' : 'Published.';
  loadReports();
}

async function loadReports() {
  const list = byId('report-list');
  const { data, error } = await sb
    .from('reports')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    list.innerHTML = `<p class="admin-empty">Couldn't load reports: ${error.message}</p>`;
    return;
  }

  LIST_ROWS.reports = data;
  renderReportList();
}

function renderReportList() {
  const list = byId('report-list');
  const rows = visibleRows('reports');
  syncFilterChrome('reports', rows.length);

  if (!LIST_ROWS.reports.length) {
    list.innerHTML = '<p class="admin-empty">Nothing published yet.</p>';
    return;
  }
  if (!rows.length) {
    list.innerHTML = '<p class="admin-empty">No reports match these filters.</p>';
    return;
  }

  list.innerHTML = rows.map(r => `
    <div class="admin-resource-row" data-id="${r.id}">
      <div>
        <h4>${r.name}</h4>
        <p>${r.sub}</p>
        <span class="admin-resource-meta">${r.file_name || 'No file attached'}</span>
      </div>
      <div class="admin-news-row-actions">
        <label class="admin-priority-field">
          <span>Priority</span>
          <input type="number" step="1" class="admin-priority-input" data-id="${r.id}" value="${r.priority ?? ''}" placeholder="upload order">
        </label>
        ${editButtonHTML('reports', r)}
        <button type="button" class="btn-second admin-delete-btn" data-id="${r.id}" data-path="${r.file_path || ''}">Delete</button>
      </div>
    </div>
  `).join('');

  wireEditButtons(list);
  list.querySelectorAll('.admin-priority-input').forEach(input => {
    input.addEventListener('change', () => handlePriorityChange('reports', input.dataset.id, input.value, loadReports));
  });
  list.querySelectorAll('.admin-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => handleReportDelete(btn.dataset.id, btn.dataset.path));
  });
}

async function handleReportDelete(id, path) {
  if (!confirm('Delete this report?')) return;
  if (path) await sb.storage.from('report-files').remove([path]);
  await sb.from('reports').delete().eq('id', id);
  loadReports();
}

/* ─────────────────────────────────────────────────────────────────────────
   TEAM — publish/list/reprioritize/delete/edit-photo for team members
   (see /supabase/reports_team_schema.sql and /supabase/team_migration.sql,
   which moved the original roster in as real rows). Photo upload is
   optional both at creation and later — a member with no photo set
   falls back to an initials avatar on the public site.
   ────────────────────────────────────────────────────────────────────── */
async function handleTeamSubmit(e) {
  e.preventDefault();
  const name = byId('team-name').value.trim();
  const role = byId('team-role').value.trim();
  const badge = byId('team-badge').value.trim();
  const affiliation = byId('team-affiliation').value.trim();
  const profile_url = byId('team-profile').value.trim();
  const priorityRaw = byId('team-priority').value.trim();
  const photo = byId('team-photo').files[0];
  const status = byId('team-status');
  const submit = byId('team-submit');
  const editing = editingRow('team');

  submit.disabled = true;
  status.textContent = editing ? 'Saving…' : 'Publishing…';

  const { data: { session } } = await sb.auth.getSession();
  const row = {
    name, role, badge,
    /* Null, not '', so the card falls back to DEFAULT_AFFILIATION rather
       than rendering "Director · " with a dangling separator. */
    affiliation: affiliation || null,
    profile_url: profile_url || null,
    priority: priorityRaw === '' ? null : Number(priorityRaw),
  };

  if (photo) {
    const path = `${crypto.randomUUID()}-${photo.name}`;
    const { error: uploadError } = await sb.storage.from('team-photos').upload(path, photo);
    if (uploadError) {
      submit.disabled = false;
      status.textContent = 'Photo upload failed: ' + uploadError.message;
      return;
    }
    row.photo_path = path;
    /* Clear any legacy photo_url so there's never ambiguity about which
       image is current — same rule as handleTeamPhotoChange(). */
    row.photo_url = null;
  } else if (!editing) {
    row.photo_path = null;
  }

  const { error } = editing
    ? await sb.from('team_members').update(row).eq('id', editing.id)
    : await sb.from('team_members').insert({ ...row, uploaded_by: session.user.id });

  submit.disabled = false;

  if (error) {
    status.textContent = (editing ? 'Saving failed: ' : 'Publish failed: ') + error.message;
    return;
  }

  if (editing && photo && editing.photo_path) {
    await sb.storage.from('team-photos').remove([editing.photo_path]);
  }

  const wasEditing = finishEdit('team');
  status.textContent = wasEditing ? 'Changes saved.' : 'Published.';
  loadTeamMembers();
}

async function loadTeamMembers() {
  const list = byId('team-list');
  const { data, error } = await sb
    .from('team_members')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    list.innerHTML = `<p class="admin-empty">Couldn't load team members: ${error.message}</p>`;
    return;
  }
  if (!data.length) {
    list.innerHTML = '<p class="admin-empty">Nothing published yet.</p>';
    return;
  }

  list.innerHTML = data.map(m => `
    <div class="admin-resource-row" data-id="${m.id}">
      <div>
        <span class="admin-resource-category">${m.badge}</span>
        <h4>${m.name}</h4>
        <p>${m.role}</p>
        <span class="admin-resource-meta">${m.affiliation ? m.affiliation : 'Lab default affiliation'} · ${(m.photo_path || m.photo_url) ? 'Has a photo' : 'No photo — initials avatar'}</span>
      </div>
      <div class="admin-news-row-actions">
        <label class="admin-priority-field">
          <span>Priority</span>
          <input type="number" step="1" class="admin-priority-input" data-id="${m.id}" value="${m.priority ?? ''}" placeholder="upload order">
        </label>
        <label class="admin-photo-field">
          <span>${(m.photo_path || m.photo_url) ? 'Replace photo' : 'Add photo'}</span>
          <input type="file" accept="image/*" class="admin-photo-input" data-id="${m.id}" data-old-path="${m.photo_path || ''}">
        </label>
        ${editButtonHTML('team', m)}
        <button type="button" class="btn-second admin-delete-btn" data-id="${m.id}" data-path="${m.photo_path || ''}">Delete</button>
      </div>
    </div>
  `).join('');

  wireEditButtons(list);
  list.querySelectorAll('.admin-priority-input').forEach(input => {
    input.addEventListener('change', () => handlePriorityChange('team_members', input.dataset.id, input.value, loadTeamMembers));
  });
  list.querySelectorAll('.admin-photo-input').forEach(input => {
    input.addEventListener('change', () => handleTeamPhotoChange(input.dataset.id, input.files[0], input.dataset.oldPath));
  });
  list.querySelectorAll('.admin-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => handleTeamDelete(btn.dataset.id, btn.dataset.path));
  });
}

/** Uploads a new photo for an existing team member and points that row
 *  at it — replaces `photo_path` (and clears any legacy `photo_url`, so
 *  there's never ambiguity about which one is current) rather than
 *  requiring a delete-and-republish round trip. The old file (if any) is
 *  removed from Storage after the row update succeeds, so a failed
 *  upload never orphans the member without a photo. */
async function handleTeamPhotoChange(id, file, oldPath) {
  if (!file) return;
  const path = `${crypto.randomUUID()}-${file.name}`;
  const { error: uploadError } = await sb.storage.from('team-photos').upload(path, file);
  if (uploadError) {
    alert('Photo upload failed: ' + uploadError.message);
    return;
  }

  const { error } = await sb.from('team_members').update({ photo_path: path, photo_url: null }).eq('id', id);
  if (error) {
    alert('Photo uploaded, but saving it to the profile failed: ' + error.message);
    return;
  }

  if (oldPath) await sb.storage.from('team-photos').remove([oldPath]);
  loadTeamMembers();
}

async function handleTeamDelete(id, path) {
  if (!confirm('Delete this team member?')) return;
  if (path) await sb.storage.from('team-photos').remove([path]);
  await sb.from('team_members').delete().eq('id', id);
  loadTeamMembers();
}

/* ─────────────────────────────────────────────────────────────────────────
   INIT
   ────────────────────────────────────────────────────────────────────── */
function initAdmin() {
  if (!sb) {
    byId('auth-status').textContent =
      'Supabase isn’t configured yet, paste your project URL and anon key into js/config.js first (see the setup notes there).';
    byId('auth-submit').disabled = true;
    return;
  }

  byId('auth-tab-login').addEventListener('click', () => setAuthMode('login'));
  byId('auth-tab-signup').addEventListener('click', () => setAuthMode('signup'));
  byId('auth-form').addEventListener('submit', handleAuthSubmit);
  byId('pending-logout').addEventListener('click', handleLogout);
  byId('dash-logout').addEventListener('click', handleLogout);
  byId('upload-form').addEventListener('submit', handleUploadSubmit);
  DASH_TABS.forEach(tab => byId('dash-tab-' + tab).addEventListener('click', () => setDashTab(tab)));
  byId('news-type').addEventListener('change', syncNewsFieldsToType);
  byId('news-form').addEventListener('submit', handleNewsSubmit);
  byId('report-form').addEventListener('submit', handleReportSubmit);
  byId('team-form').addEventListener('submit', handleTeamSubmit);
  Object.keys(PANEL_FORMS).forEach(panel => {
    byId(PANEL_FORMS[panel].cancel).addEventListener('click', () => cancelEdit(panel));
  });
  initListFilters();

  sb.auth.onAuthStateChange((_event, session) => syncViewToSession(session));
  sb.auth.getSession().then(({ data: { session } }) => syncViewToSession(session));
}

document.addEventListener('DOMContentLoaded', initAdmin);
