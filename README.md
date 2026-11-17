# HEAL-AI

Website and supporting documents for the Stanford HEAL-AI Lab (Health AI Evaluation).

**Live site:** https://heal-ai.stanford.edu

## Structure

The static site lives at the repository root. It has no build step — the
Pages workflow copies the site files into an artifact and publishes that.

- `index.html` — page structure/markup
- `admin.html` — admin dashboard (unlinked from the public site; Supabase auth + RLS gated)
- `js/config.js` — site-wide toggles (video phase flag, sign-up form URL, Supabase keys)
- `js/data.js` — all page copy/content
- `js/app.js` — client-side routing and rendering logic
- `js/safe-html.js` — `escapeHTML()` and `safeURL()`, used by both pages on
  anything that came from the database
- `css/style.css` — styling and design tokens
- `assets/` — images, logos, staff photos
- `supabase/` — database schema and RLS policies (run in the Supabase SQL Editor).
  `supabase/fix_uploader_policies.sql` makes editing and deleting admin-only;
  it has to be run by hand once — its header says how to check before and after.
- `google-apps-script/signup-sheet.gs` — source of the sign-up endpoint that
  appends to the signups Google Sheet. Runs in Google, not on this site.
- `.github/workflows/pages.yml` — the deploy. Publishes an **allowlist** of
  site paths, so anything else in the repo is excluded from the published
  website by default (the GitHub repository itself is public — see below).
- `tools/test-site.mjs` — the website's tests (see "Testing" below)
- `.nojekyll` — serve files as-is, without Jekyll processing
- `HEAL AI Website Org Plan.docx.pdf` — site organization/planning doc (not published)
- `HEAL-AI_Master_Landscape_Report Final.docx.pdf` — landscape report (not published)

## Running locally

The site is framework-free (no build step). Serve it with any static file server:

```bash
python3 -m http.server 5178
```

Then open http://localhost:5178.

## Testing

```bash
node tools/test-site.mjs
```

Plain Node (18 or newer), nothing to install. It loads the real
`js/safe-html.js`, `js/config.js`, `js/data.js` and `js/app.js` into a small
fake browser, plus `google-apps-script/signup-sheet.gs` with a fake Sheet,
and checks what a visitor or editor would end up seeing:

- text typed into the admin dashboard shows as text, never runs as code,
  and `javascript:`-style links are refused;
- the built-in content from `js/data.js` renders exactly as before;
- an assistant citation `#reports?open=<id>` opens that report even when the
  page was opened fresh and the reports arrive from the database later;
- the signup script stores `=…` formulas as plain text and its health check
  reveals nothing about the Sheet.

`node tools/test-site.mjs --ref main` runs the same checks against the code
in another git commit, which is how you show a new test fails without the
fix. The deploy workflow runs the tests first and stops if any fail.

## Deploying

GitHub Pages, at https://heal-ai.stanford.edu. **Push to `main` and it
deploys** — `.github/workflows/pages.yml` does it, and it works from any
machine or from the GitHub web UI. Watch a run in the Actions tab; you can
also re-publish without a code change via "Run workflow" there.

### The site is an allowlist

The workflow publishes only the paths named in `SITE_PATHS`. That is
deliberate: the repo root also holds internal planning PDFs, the database
schema and RLS policies, and the Apps Script source containing the signups
Sheet id. Publishing from the branch directly served all of those.

**Excluded from the website is not the same as private.** The GitHub
repository itself is public, so everything in it, including those PDFs, the
SQL and the Apps Script, and every earlier version in the git history, can be
read on github.com. The allowlist only keeps files off heal-ai.stanford.edu.
Anything that must stay confidential should not be committed here.

**Adding a file to the site means adding it to `SITE_PATHS`.** Forgetting to
is a 404 you will notice; a denylist's failure mode is a silent leak. A
second step in the job asserts that no `.sql`, `.gs`, `.pdf`, `supabase/` or
`google-apps-script/` content made it into the artifact, and fails the build
if it did.

Caveats worth knowing:

- Routing is hash-based (`#toolkit`, `#about`), so deep links and refreshes
  work on any static host, including from a subpath like `/heal-ai/`.
- Pages has no URL rewriting, so the workflow also writes `admin.html` to
  `/admin/index.html` to keep `/admin` working. That copy's `css/`, `js/` and
  `assets/` links are rewritten to `../css/` and so on, because one folder
  down the original links pointed at `/admin/css/…`, which does not exist.
- `CNAME` must stay in `SITE_PATHS` or Pages drops the custom domain.
