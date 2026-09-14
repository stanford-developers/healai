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
- `css/style.css` — styling and design tokens
- `assets/` — images, logos, staff photos
- `supabase/` — database schema and RLS policies (run in the Supabase SQL Editor)
- `google-apps-script/signup-sheet.gs` — source of the sign-up endpoint that
  appends to the signups Google Sheet. Runs in Google, not on this site.
- `.github/workflows/pages.yml` — the deploy. Publishes an **allowlist** of
  site paths, so anything else in the repo is private by default.
- `.nojekyll` — serve files as-is, without Jekyll processing
- `HEAL AI Website Org Plan.docx.pdf` — site organization/planning doc (not published)
- `HEAL-AI_Master_Landscape_Report Final.docx.pdf` — landscape report (not published)

## Running locally

The site is framework-free (no build step). Serve it with any static file server:

```bash
python3 -m http.server 5178
```

Then open http://localhost:5178.

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

**Adding a file to the site means adding it to `SITE_PATHS`.** Forgetting to
is a 404 you will notice; a denylist's failure mode is a silent leak. A
second step in the job asserts that no `.sql`, `.gs`, `.pdf`, `supabase/` or
`google-apps-script/` content made it into the artifact, and fails the build
if it did.

Caveats worth knowing:

- Routing is hash-based (`#toolkit`, `#about`), so deep links and refreshes
  work on any static host, including from a subpath like `/heal-ai/`.
- Pages has no URL rewriting, so the workflow also writes `admin.html` to
  `/admin/index.html` to keep `/admin` working.
- `CNAME` must stay in `SITE_PATHS` or Pages drops the custom domain.
