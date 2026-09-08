-- HEAL-AI: migrate the 7 static team members into team_members
--
-- Run this once, in full, AFTER reports_team_schema.sql has already been
-- run (Project → SQL Editor → New query → paste this whole file → Run).
--
-- Why this exists: team_members was originally designed so admin-added
-- people MERGE with the static TEAM array in js/data.js (same pattern as
-- News's placeholder entries) — the static 7 were never meant to be
-- editable from /admin.html, only new additions were. This migration
-- makes the admin dashboard the single source of truth for the whole
-- team grid instead: it inserts the current 7 as real rows here, and a
-- matching commit empties TEAM in data.js (which stays as a fallback —
-- see the comment above it — so the section never goes fully blank if
-- Supabase is briefly unreachable).
--
-- Two schema tweaks this needs first:
--   1. `photo_url` — a new nullable column for a photo referenced by URL
--      /relative path rather than uploaded to the team-photos bucket.
--      The 7 migrated rows point straight at their existing
--      /assets/current_staff/*.webp files — no need to re-upload images
--      that already work fine as static assets. getPublicTeamMembers()
--      (js/app.js) prefers `photo_url` over `photo_path` when both
--      could apply.
--   2. `uploaded_by` becomes nullable — these 7 weren't uploaded by any
--      particular admin account, so there's no real user id to put
--      there. (RLS still requires an admin to insert/update/delete rows
--      regardless of whether uploaded_by is set — see reports_team_schema.sql.)
--
-- `priority` is set explicitly (100 down to 94) on all 7 so they keep
-- their current order regardless of what order Postgres happens to
-- return rows in. Leave newly-admin-added people without a priority and
-- they'll simply sort after these by newest-first (see prioritySort() in
-- js/app.js) — set one yourself if you want a new hire to slot in
-- earlier than that.

alter table public.team_members add column if not exists photo_url text;
alter table public.team_members alter column uploaded_by drop not null;

insert into public.team_members (name, role, badge, photo_url, profile_url, priority) values
  ('Michelle Mello',       'Professor of Law and of Health Policy',            'Director',                 'assets/current_staff/michelle-mello1673734692135.png.webp',    'https://law.stanford.edu/michelle-m-mello/',              100),
  ('Danton Samuel Char',   'Principal Investigator',                           'Director',                 'assets/current_staff/danton_samuel_char.png.webp',             'https://profiles.stanford.edu/danton-char',               99),
  ('Nigam Shah',           'Professor of Medicine (Biomedical Informatics)',   'Faculty',                  'assets/current_staff/nigam_shah_char.png.webp',                'https://profiles.stanford.edu/nigam-shah',                98),
  ('N. Lance Downing',     'Clinical Assistant Professor',                     'Faculty',                  'assets/current_staff/norman-downing1509518804318.png.webp',    null,                                                       97),
  ('Artem A. Trotsyuk',    'Postdoctoral Scholar',                             'Member of Technical Staff', 'assets/current_staff/artem-trotsyuk1694722251843.png.webp',    'https://profiles.stanford.edu/artem-trotsyuk',            96),
  ('Elisabeth Grosvenor',  'Life Science Research Professional 1',             'Research',                 'assets/current_staff/elisabeth-grosvenor1667954347746.png.webp', null,                                                     95),
  ('Alison Callahan',      'Research Engineer',                                'Member of Technical Staff', 'assets/current_staff/alison-callahan1770857252230.png.webp',   'https://med.stanford.edu/profiles/alison-callahan',       94);
