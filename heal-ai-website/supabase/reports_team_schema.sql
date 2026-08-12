-- HEAL-AI admin uploads, round 2: Sample Reports + Team
--
-- Run this once, in full, AFTER schema.sql and news_schema.sql have already
-- been run (Project → SQL Editor → New query → paste this whole file → Run).
--
-- What this sets up:
--   1. reports         one row per admin-published sample report (the same
--                      rich shape as the 8 static ones: overview, summary,
--                      key issues, optional downloadable file)
--   2. team_members    one row per admin-published team member (name,
--                      role, badge, optional photo, optional profile link)
--   3. RLS policies    public can read everything; only an admin can write
--                      (identical policy shape to resources/news_items)
--   4. a `resources` category fix — the Toolkit "resources" table used to
--      bucket uploads by the 3 top-level tabs (template/guide/report).
--      The "report" bucket is retired now that Sample Reports has its own
--      dedicated table above; template/guide are split into the 4 actual
--      Resource categories (interviews/panel/understand/adapt) so an
--      upload lands in the specific section it belongs to, not a generic
--      "Recently added" strip at the bottom of the whole tab.
--
-- After running this, also create two public Storage buckets:
--   "report-files" (for the optional "Download Full Report" file)
--   "team-photos"  (for team member portraits)
-- (Storage → New bucket → name it → toggle Public on), then run the
-- storage policies at the bottom of this file.

-- ── 1. reports ───────────────────────────────────────────────────────────
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  name text not null,                        -- tool nickname, e.g. "HeartRead"
  sub text not null,                         -- one-line subtitle on the tile
  overview text not null,
  summary text not null,
  issues text[] not null default '{}',
  file_path text,                            -- optional uploaded "Download Full Report" file
  file_name text,
  priority integer,                          -- higher = shown earlier in the grid; null = after static reports, newest first
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.reports enable row level security;

create policy "reports are publicly readable"
  on public.reports for select
  using (true);

create policy "only admins can insert reports"
  on public.reports for insert
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

create policy "uploader or admin can update reports"
  on public.reports for update
  using (
    uploaded_by = auth.uid()
    or exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

create policy "uploader or admin can delete reports"
  on public.reports for delete
  using (
    uploaded_by = auth.uid()
    or exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );


-- ── 2. team_members ──────────────────────────────────────────────────────
create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null,
  badge text not null,                       -- e.g. "Director" / "Faculty" / "Staff"
  photo_path text,                           -- optional uploaded portrait; falls back to initials avatar
  profile_url text,                          -- optional external profile link
  priority integer,                          -- higher = shown earlier in the grid; null = after static team, newest first
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.team_members enable row level security;

create policy "team_members are publicly readable"
  on public.team_members for select
  using (true);

create policy "only admins can insert team_members"
  on public.team_members for insert
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

create policy "uploader or admin can update team_members"
  on public.team_members for update
  using (
    uploaded_by = auth.uid()
    or exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

create policy "uploader or admin can delete team_members"
  on public.team_members for delete
  using (
    uploaded_by = auth.uid()
    or exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );


-- ── 3. Storage policies ──────────────────────────────────────────────────
-- Run this AFTER creating the "report-files" and "team-photos" buckets.

create policy "public read report-files"
  on storage.objects for select
  using (bucket_id = 'report-files');

create policy "admins can upload report-files"
  on storage.objects for insert
  with check (
    bucket_id = 'report-files'
    and exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

create policy "admins can delete report-files"
  on storage.objects for delete
  using (
    bucket_id = 'report-files'
    and exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

create policy "public read team-photos"
  on storage.objects for select
  using (bucket_id = 'team-photos');

create policy "admins can upload team-photos"
  on storage.objects for insert
  with check (
    bucket_id = 'team-photos'
    and exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

create policy "admins can delete team-photos"
  on storage.objects for delete
  using (
    bucket_id = 'team-photos'
    and exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );


-- ── 4. Fix up `resources.category` ───────────────────────────────────────
-- Old values: 'template' | 'guide' | 'report' (one bucket per top-level tab).
-- New values: 'interviews' | 'panel' | 'understand' | 'adapt' (one bucket
-- per actual Resource category, so uploads blend into the specific
-- section they belong to). 'report' is dropped entirely — Sample Reports
-- now uses the dedicated `reports` table above.
--
-- Any existing row with category = 'report' (e.g. a test upload) no
-- longer fits anywhere and is deleted below. If you have a real report
-- uploaded that way, re-add it through the new Sample Reports admin form
-- instead before running this.
delete from public.resources where category = 'report';

do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.resources'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%category%';
  if cname is not null then
    execute format('alter table public.resources drop constraint %I', cname);
  end if;
end $$;

alter table public.resources add constraint resources_category_check
  check (category in ('interviews', 'panel', 'understand', 'adapt'));
