/*
═════════════════════════════════════════════════════════════════════════════
 HEAL-AI · js/admin.js
─────────────────────────────────────────────────────────────────────────────
 PURPOSE
   Everything admin.html needs: auth (login/signup/logout/session), and the
   upload/list/delete flow for Toolkit resources. All of it talks directly
   to Supabase from the browser, there is no server code in this repo, so
   every permission check below is enforced twice: once here (for a decent
   user experience) and once server-side by Postgres Row Level Security
   (see /supabase/schema.sql), which is the check that actually matters for
   security. Never trust the client-side one alone.

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

  sb.auth.onAuthStateChange((_event, session) => syncViewToSession(session));
  sb.auth.getSession().then(({ data: { session } }) => syncViewToSession(session));
}

document.addEventListener('DOMContentLoaded', initAdmin);
