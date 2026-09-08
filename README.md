# HEAL-AI

Website and supporting documents for the Stanford HEAL-AI Lab (Health AI Evaluation).

**Live site:** https://heal-ai-website.vercel.app
**GitHub Pages mirror:** Not launched due to Org Restrictions

## Structure

The static site lives at the repository root, so GitHub Pages can serve it
directly from the `main` branch without a build step.

- `index.html` — page structure/markup
- `admin.html` — admin dashboard (unlinked from the public site; Supabase auth + RLS gated)
- `js/config.js` — site-wide toggles (video phase flag, sign-up form URL, Supabase keys)
- `js/data.js` — all page copy/content
- `js/app.js` — client-side routing and rendering logic
- `css/style.css` — styling and design tokens
- `assets/` — images, logos, staff photos
- `supabase/` — database schema and RLS policies (run in the Supabase SQL Editor)
- `.nojekyll` — tells GitHub Pages to serve files as-is, without Jekyll processing
- `.vercelignore` — repo files that must NOT be served (internal PDFs, `supabase/`).
  Needed because the deploy root is now the repo root: anything not listed
  there is publicly fetchable. Note this covers Vercel only — GitHub Pages
  ignores it and would publish those files, so exclude them there too before
  enabling Pages.
- `HEAL AI Website Org Plan.docx.pdf` — site organization/planning doc
- `HEAL-AI_Master_Landscape_Report Final.docx.pdf` — landscape report

## Running locally

The site is framework-free (no build step). Serve it with any static file server:

```bash
python3 -m http.server 5178
```

Then open http://localhost:5178.

## Deploying

Production is Vercel, serving from the repository root:
https://heal-ai-website.vercel.app

**Pushing to GitHub does not deploy on its own.** Vercel's git integration
for this project is broken — its link points at `shai-yaan/heal-ai`, the path
from before the repo moved into `stanford-developers`, and Vercel's GitHub App
has no access to that SAML-enforced org (the API answers `repo_not_found`).
Fixing it properly needs an org owner to authorize the Vercel GitHub App.

Until then a committed `pre-push` hook covers the gap: pushing `main` from a
clone with the hook installed deploys automatically. Enable it once per clone:

```bash
git config core.hooksPath .githooks
```

To deploy by hand, or after a commit made outside this working copy:

```bash
vercel --prod
```

Caveats worth knowing:

- The hook only fires for pushes **from your machine**. A commit made in the
  GitHub web UI, or pushed by a collaborator, will not deploy.
- Skip it for a docs-only push with `git push --no-verify`.
- Routing is hash-based (`#toolkit`, `#about`), so deep links and refreshes
  work on any static host, including from a subpath like `/heal-ai/`.
