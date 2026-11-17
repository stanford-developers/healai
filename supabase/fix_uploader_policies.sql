-- ═══════════════════════════════════════════════════════════════════════════
-- HEAL-AI · fix_uploader_policies.sql
-- ───────────────────────────────────────────────────────────────────────────
-- WHAT WAS WRONG (finding W2 of the 2026-11-17 review)
--   The first schema files let the person who uploaded a row keep editing
--   and deleting it forever:
--
--     using ( uploaded_by = auth.uid() or <is an admin> )
--
--   That was meant as "admins, plus the author of their own row". But it
--   means that when someone stops being an admin (profiles.is_admin set to
--   false), they can still change or delete everything they ever published,
--   by calling Supabase directly. The dashboard hides itself from them; the
--   database does not stop them.
--
--   Later migrations added "only admins can update …" policies, but that
--   does not cancel the old ones. Postgres combines policies for the same
--   command with OR, so the wider uploader rule still lets them through.
--
-- WHAT THIS DOES
--   For resources, reports, team_members and news_items:
--     • drops the uploader-or-admin UPDATE and DELETE policies
--     • (re)creates admin-only UPDATE and DELETE policies, so admins lose
--       nothing — the dashboard's edit, re-order and delete keep working
--   Reads (public) and inserts (already admin-only) are not touched, and
--   neither are the Storage bucket policies, which are already admin-only.
--
-- SAFE TO RUN TWICE
--   Every policy is dropped "if exists" before it is created, so a second
--   run ends in the same state. It all runs in one transaction: if any line
--   fails, nothing changes, and there is never a moment where admins have
--   no update or delete policy.
--
-- HOW TO RUN IT (a person with access to the Supabase project)
--   1. Look first. In the Supabase SQL Editor run:
--
--        select tablename, policyname, cmd, qual
--        from pg_policies
--        where schemaname = 'public'
--          and tablename in ('resources','reports','team_members','news_items')
--        order by tablename, cmd, policyname;
--
--      Any UPDATE or DELETE policy whose `qual` mentions uploaded_by is the
--      problem. If one has a name not listed below (someone created it by
--      hand), add a matching "drop policy if exists" line before running.
--   2. Paste this whole file into the SQL Editor and run it.
--   3. Run the query from step 1 again. Each of the four tables should show
--      exactly one UPDATE and one DELETE policy, both "only admins can …",
--      and no policy that mentions uploaded_by.
--   4. Check the dashboard still works for an admin: change one item's
--      order number and change it back.
--
-- Not applied anywhere by the commit that added it. Not part of
-- ALL_MIGRATIONS.sql, which is the historical setup script.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ── resources (policies from schema.sql) ────────────────────────────────
drop policy if exists "uploader or admin can update" on public.resources;
drop policy if exists "uploader or admin can delete" on public.resources;

-- Same definition as resources_admin_migration.sql, recreated so this file
-- works whether or not that migration was run.
drop policy if exists "only admins can update resources" on public.resources;
create policy "only admins can update resources"
  on public.resources for update
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

drop policy if exists "only admins can delete resources" on public.resources;
create policy "only admins can delete resources"
  on public.resources for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));


-- ── reports (policies from reports_team_schema.sql) ─────────────────────
drop policy if exists "uploader or admin can update reports" on public.reports;
drop policy if exists "uploader or admin can delete reports" on public.reports;

-- Same definition as reports_admin_migration.sql.
drop policy if exists "only admins can update reports" on public.reports;
create policy "only admins can update reports"
  on public.reports for update
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

drop policy if exists "only admins can delete reports" on public.reports;
create policy "only admins can delete reports"
  on public.reports for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));


-- ── team_members (policies from reports_team_schema.sql) ────────────────
drop policy if exists "uploader or admin can update team_members" on public.team_members;
drop policy if exists "uploader or admin can delete team_members" on public.team_members;

drop policy if exists "only admins can update team_members" on public.team_members;
create policy "only admins can update team_members"
  on public.team_members for update
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

drop policy if exists "only admins can delete team_members" on public.team_members;
create policy "only admins can delete team_members"
  on public.team_members for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));


-- ── news_items (policies from news_schema.sql) ──────────────────────────
drop policy if exists "publisher or admin can update news_items" on public.news_items;
drop policy if exists "publisher or admin can delete news_items" on public.news_items;

drop policy if exists "only admins can update news_items" on public.news_items;
create policy "only admins can update news_items"
  on public.news_items for update
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

drop policy if exists "only admins can delete news_items" on public.news_items;
create policy "only admins can delete news_items"
  on public.news_items for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

commit;
