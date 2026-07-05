# HEAL-AI

Website and supporting documents for the Stanford HEAL-AI Lab (Health AI Evaluation).

**Live site:** https://heal-ai-website.vercel.app

## Structure

- [`heal-ai-website/`](heal-ai-website) — the static site (deployed to Vercel)
  - `index.html` — page structure/markup
  - `js/config.js` — site-wide toggles (video phase flag, sign-up form URL, branding)
  - `js/data.js` — all page copy/content
  - `js/app.js` — client-side routing and rendering logic
  - `css/style.css` — styling and design tokens
  - `assets/` — images, logos, staff photos
- `HEAL AI Website Org Plan.docx.pdf` — site organization/planning doc
- `HEAL-AI_Master_Landscape_Report Final.docx.pdf` — landscape report

## Running locally

The site is framework-free (no build step). Serve it with any static file server:

```bash
python3 -m http.server 5178 --directory heal-ai-website
```

Then open http://localhost:5178.

## Deploying

Deploys go to Vercel from the `heal-ai-website` directory:

```bash
cd heal-ai-website
vercel --prod
```
