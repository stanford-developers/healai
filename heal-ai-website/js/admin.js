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
const DASH_H2   = { resources: 'Upload a resource', reports: 'Publish a report', team: 'Publish a team member', news: 'Publish a news item' };

function setDashTab(name) {
  DASH_TABS.forEach(tab => {
    byId('dash-tab-' + tab).classList.toggle('on', tab === name);
    byId('dash-tab-' + tab).setAttribute('aria-selected', tab === name);
    byId('dash-panel-' + tab).hidden = tab !== name;
  });
  byId('dash-h2').textContent = DASH_H2[name];
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

/* ─────────────────────────────────────────────────────────────────────────
   UPLOAD / LIST / DELETE
   ────────────────────────────────────────────────────────────────────── */
async function handleUploadSubmit(e) {
  e.preventDefault();
  const fileInput = byId('upload-file');
  const file = fileInput.files[0];
  const title = byId('upload-title').value.trim();
  const description = byId('upload-description').value.trim();
  const category = byId('upload-category').value;
  const status = byId('upload-status');
  const submit = byId('upload-submit');

  if (!file) { status.textContent = 'Choose a file first.'; return; }

  submit.disabled = true;
  status.textContent = 'Uploading…';

  const { data: { session } } = await sb.auth.getSession();
  const path = `${category}/${crypto.randomUUID()}-${file.name}`;

  const { error: uploadError } = await sb.storage.from('resource-files').upload(path, file);
  if (uploadError) {
    submit.disabled = false;
    status.textContent = 'Upload failed: ' + uploadError.message;
    return;
  }

  const { error: insertError } = await sb.from('resources').insert({
    title, description, category,
    file_path: path,
    file_name: file.name,
    file_size_bytes: file.size,
    uploaded_by: session.user.id,
  });

  submit.disabled = false;

  if (insertError) {
    status.textContent = 'File uploaded, but saving its details failed: ' + insertError.message;
    return;
  }

  status.textContent = 'Uploaded.';
  byId('upload-form').reset();
  loadResources();
}

function formatBytes(n) {
  if (!n) return '';
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return Math.round(n / 1024) + ' KB';
  return (n / (1024 * 1024)).toFixed(1) + ' MB';
}

async function loadResources() {
  const list = byId('resource-list');
  const { data, error } = await sb
    .from('resources')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    list.innerHTML = `<p class="admin-empty">Couldn't load resources: ${error.message}</p>`;
    return;
  }
  if (!data.length) {
    list.innerHTML = '<p class="admin-empty">Nothing uploaded yet.</p>';
    return;
  }

  list.innerHTML = data.map(r => `
    <div class="admin-resource-row" data-id="${r.id}">
      <div>
        <span class="admin-resource-category">${r.category}</span>
        <h4>${r.title}</h4>
        <p>${r.description || ''}</p>
        <span class="admin-resource-meta">${r.file_name || ''} · ${formatBytes(r.file_size_bytes)}</span>
      </div>
      <button type="button" class="btn-second admin-delete-btn" data-id="${r.id}" data-path="${r.file_path}">Delete</button>
    </div>
  `).join('');

  list.querySelectorAll('.admin-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => handleDelete(btn.dataset.id, btn.dataset.path));
  });
}

async function handleDelete(id, path) {
  if (!confirm('Delete this resource? This removes the file too.')) return;
  await sb.storage.from('resource-files').remove([path]);
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
  byId('news-field-speaker').hidden = type !== 'seminar_video';
  byId('news-field-venue').hidden   = type !== 'seminar_video';
  byId('news-field-source').hidden  = type !== 'news_article';
  byId('news-field-authors').hidden = type !== 'scholarly_publication';
  byId('news-field-journal').hidden = type !== 'scholarly_publication';
}

/** Reads only the meta fields relevant to `type` — an unselected type's
 *  fields are left blank in the form and shouldn't be saved as empty
 *  strings on a row they don't apply to. */
function collectNewsMeta(type) {
  if (type === 'seminar_video') {
    return { speaker: byId('news-speaker').value.trim(), venue: byId('news-venue').value.trim() };
  }
  if (type === 'news_article') {
    return { source: byId('news-source').value.trim() };
  }
  return { authors: byId('news-authors').value.trim(), journal: byId('news-journal').value.trim() };
}

async function handleNewsSubmit(e) {
  e.preventDefault();
  const type = byId('news-type').value;
  const title = byId('news-title').value.trim();
  const description = byId('news-description').value.trim();
  const date = byId('news-date').value;
  const link = byId('news-link').value.trim();
  const priorityRaw = byId('news-priority').value.trim();
  const status = byId('news-status');
  const submit = byId('news-submit');

  submit.disabled = true;
  status.textContent = 'Publishing…';

  const { data: { session } } = await sb.auth.getSession();
  const { error } = await sb.from('news_items').insert({
    type, title, description, date,
    link: link || null,
    priority: priorityRaw === '' ? null : Number(priorityRaw),
    meta: collectNewsMeta(type),
    uploaded_by: session.user.id,
  });

  submit.disabled = false;

  if (error) {
    status.textContent = 'Publish failed: ' + error.message;
    return;
  }

  status.textContent = 'Published.';
  byId('news-form').reset();
  syncNewsFieldsToType();
  loadNewsItems();
}

const NEWS_TYPE_LABEL = { seminar_video: 'Seminar video', news_article: 'News article', scholarly_publication: 'Scholarly publication' };

/** One line of type-specific meta, shown under the title — mirrors how
 *  the public News tab shows "speaker · venue" / "source" / "authors · journal". */
function newsMetaLine(r) {
  const m = r.meta || {};
  if (r.type === 'seminar_video') return [m.speaker, m.venue].filter(Boolean).join(' · ');
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
  if (!data.length) {
    list.innerHTML = '<p class="admin-empty">Nothing published yet.</p>';
    return;
  }

  list.innerHTML = data.map(r => `
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
        <button type="button" class="btn-second admin-delete-btn" data-id="${r.id}">Delete</button>
      </div>
    </div>
  `).join('');

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

  submit.disabled = true;
  status.textContent = 'Publishing…';

  const { data: { session } } = await sb.auth.getSession();
  let file_path = null, file_name = null;

  if (file) {
    const path = `${crypto.randomUUID()}-${file.name}`;
    const { error: uploadError } = await sb.storage.from('report-files').upload(path, file);
    if (uploadError) {
      submit.disabled = false;
      status.textContent = 'File upload failed: ' + uploadError.message;
      return;
    }
    file_path = path;
    file_name = file.name;
  }

  const { error } = await sb.from('reports').insert({
    name, sub, overview, summary, issues,
    file_path, file_name,
    priority: priorityRaw === '' ? null : Number(priorityRaw),
    uploaded_by: session.user.id,
  });

  submit.disabled = false;

  if (error) {
    status.textContent = 'Publish failed: ' + error.message;
    return;
  }

  status.textContent = 'Published.';
  byId('report-form').reset();
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
  if (!data.length) {
    list.innerHTML = '<p class="admin-empty">Nothing published yet.</p>';
    return;
  }

  list.innerHTML = data.map(r => `
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
        <button type="button" class="btn-second admin-delete-btn" data-id="${r.id}" data-path="${r.file_path || ''}">Delete</button>
      </div>
    </div>
  `).join('');

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
   TEAM — publish/list/reprioritize/delete for team members (see
   /supabase/reports_team_schema.sql). Photo upload is optional — the
   public site falls back to an initials avatar, same as a static TEAM
   entry with no `photo` set.
   ────────────────────────────────────────────────────────────────────── */
async function handleTeamSubmit(e) {
  e.preventDefault();
  const name = byId('team-name').value.trim();
  const role = byId('team-role').value.trim();
  const badge = byId('team-badge').value.trim();
  const profile_url = byId('team-profile').value.trim();
  const priorityRaw = byId('team-priority').value.trim();
  const photo = byId('team-photo').files[0];
  const status = byId('team-status');
  const submit = byId('team-submit');

  submit.disabled = true;
  status.textContent = 'Publishing…';

  const { data: { session } } = await sb.auth.getSession();
  let photo_path = null;

  if (photo) {
    const path = `${crypto.randomUUID()}-${photo.name}`;
    const { error: uploadError } = await sb.storage.from('team-photos').upload(path, photo);
    if (uploadError) {
      submit.disabled = false;
      status.textContent = 'Photo upload failed: ' + uploadError.message;
      return;
    }
    photo_path = path;
  }

  const { error } = await sb.from('team_members').insert({
    name, role, badge, photo_path,
    profile_url: profile_url || null,
    priority: priorityRaw === '' ? null : Number(priorityRaw),
    uploaded_by: session.user.id,
  });

  submit.disabled = false;

  if (error) {
    status.textContent = 'Publish failed: ' + error.message;
    return;
  }

  status.textContent = 'Published.';
  byId('team-form').reset();
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
        <span class="admin-resource-meta">${m.photo_path ? 'Photo uploaded' : 'No photo — initials avatar'}</span>
      </div>
      <div class="admin-news-row-actions">
        <label class="admin-priority-field">
          <span>Priority</span>
          <input type="number" step="1" class="admin-priority-input" data-id="${m.id}" value="${m.priority ?? ''}" placeholder="upload order">
        </label>
        <button type="button" class="btn-second admin-delete-btn" data-id="${m.id}" data-path="${m.photo_path || ''}">Delete</button>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('.admin-priority-input').forEach(input => {
    input.addEventListener('change', () => handlePriorityChange('team_members', input.dataset.id, input.value, loadTeamMembers));
  });
  list.querySelectorAll('.admin-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => handleTeamDelete(btn.dataset.id, btn.dataset.path));
  });
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

  sb.auth.onAuthStateChange((_event, session) => syncViewToSession(session));
  sb.auth.getSession().then(({ data: { session } }) => syncViewToSession(session));
}

document.addEventListener('DOMContentLoaded', initAdmin);
