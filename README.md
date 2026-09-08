# HEAL-AI

Website and supporting documents for the Stanford HEAL-AI Lab (Health AI Evaluation).

**Live site:** https://heal-ai-website.vercel.app
**GitHub Pages mirror:** https://shai-yaan.github.io/heal-ai/

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

Two deploy targets, both serving from the repository root:

- **GitHub Pages** — deploys automatically on every push to `main`.
- **Vercel** — `vercel --prod` from the repository root.

Routing is hash-based (`#toolkit`, `#about`), so both hosts serve deep links
and page refreshes correctly even from a subpath like `/heal-ai/`.
