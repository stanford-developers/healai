-- ═══════════════════════════════════════════════════════════════════════════
-- HEAL-AI · make each team member's affiliation editable
-- ───────────────────────────────────────────────────────────────────────────
-- WHY
--   The line under a team member's name on the About page read
--   "<badge> · Stanford Health Care", with the institution hardcoded in
--   js/app.js. It could only be changed by editing code, and every member
--   was forced to show the same one — no way to credit a collaborator from
--   another institution.
--
-- WHAT THIS ADDS
--   A nullable `affiliation` column. Left null, the card falls back to
--   DEFAULT_AFFILIATION in js/data.js, so changing the institution for the
--   whole team is still a one-line edit in one place. Set it on a row and
--   that member overrides the default.
--
--   Nullable on purpose rather than backfilled with 'Stanford Health Care':
--   a null genuinely means "whatever the lab's default is" and keeps
--   following it, where a copied-in value would silently go stale the next
--   time the default changes.
--
-- SAFE TO RE-RUN
--   `if not exists` — running it twice does nothing the second time.
--
-- HOW TO RUN
--   Supabase dashboard → SQL Editor → paste this file → Run.
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.team_members
  add column if not exists affiliation text;

comment on column public.team_members.affiliation is
  'Institution shown after the badge on the About page team card. Null means use DEFAULT_AFFILIATION from js/data.js.';
