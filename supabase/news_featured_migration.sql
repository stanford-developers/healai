-- ═══════════════════════════════════════════════════════════════════════════
-- HEAL-AI · let an admin pick which news item the spotlight features
-- ───────────────────────────────────────────────────────────────────────────
-- WHY
--   The News tab's featured bar had no control behind it. It showed whichever
--   seminar video carried `featured: true` in js/data.js — a flag only ever
--   set on a hardcoded entry — and otherwise just whatever sorted to the top.
--   So rotating the spotlight meant a code change, and only a seminar video
--   could ever appear there.
--
-- WHAT THIS ADDS
--   A `featured` boolean, plus a partial unique index that allows at most one
--   featured row at a time. The index is the real guarantee: the admin UI
--   clears the old pick before setting the new one, but if that ever ran out
--   of order — two tabs open, a half-finished request — the database refuses
--   the second row rather than leaving the site with two "featured" items and
--   no defined winner.
--
--   Any of the three feeds can be featured now, not just seminars;
--   renderNewsSpotlight() in app.js adapts its meta line and button to the
--   item's type.
--
-- SAFE TO RE-RUN
--   Both statements are `if not exists`.
--
-- HOW TO RUN
--   Supabase dashboard → SQL Editor → paste this file → Run.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.news_items
  add column if not exists featured boolean not null default false;

-- Partial index: only rows with featured = true participate, so any number
-- of rows may be false while at most one may be true.
create unique index if not exists news_items_single_featured
  on public.news_items (featured)
  where featured;

comment on column public.news_items.featured is
  'Exactly one row may be true. Drives the News tab spotlight; chosen from the picker at the top of /admin.html → News.';
