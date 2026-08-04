-- HEAL-AI Toolkit admin uploads: Supabase schema
--
-- Run this once, in full, in your Supabase project's SQL Editor
-- (Project → SQL Editor → New query → paste this whole file → Run).
--
-- What this sets up:
--   1. profiles       one row per signed-up user, with an is_admin flag
--   2. resources      one row per uploaded document (template/guide/report)
--   3. RLS policies    public can read everything; only an admin can write
--   4. a trigger       auto-creates a profiles row whenever someone signs up
--
-- After running this, also create a public Storage bucket named
-- "resource-files" (Storage → New bucket → name it, toggle Public on),
-- then run the storage policies at the bottom of this file.

-- ── 1. profiles ──────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Anyone can read profiles. Only used internally to check is_admin, and
-- no sensitive data is stored here.
create policy "profiles are publicly readable"
  on public.profiles for select
  using (true);

-- A user can only ever insert their own profile row, and cannot set
-- is_admin=true themselves even by crafting the request directly.
create policy "users insert own profile, not as admin"
  on public.profiles for insert
  with check (auth.uid() = id and is_admin = false);

-- Users can update their own row, but never change their own is_admin
-- value. Admin status can only be granted by hand in the Table Editor.
create policy "users update own profile but not is_admin"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and is_admin = (select is_admin from public.profiles where id = auth.uid())
  );

-- Auto-create a profiles row whenever someone signs up via Supabase Auth.
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ── 2. resources ─────────────────────────────────────────────────────────
create table public.resources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category text not null check (category in ('template', 'guide', 'report')),
  file_path text not null,
  file_name text,
  file_size_bytes bigint,
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.resources enable row level security;

-- Public read: anyone, including a logged-out visitor, can read all rows.
-- This is what lets the public Toolkit page show uploaded resources
-- without requiring a login.
create policy "resources are publicly readable"
  on public.resources for select
  using (true);

-- Only an admin (profiles.is_admin = true) can insert a new resource row.
create policy "only admins can insert resources"
  on public.resources for insert
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- The original uploader, or any admin, can update or delete a row.
create policy "uploader or admin can update"
  on public.resources for update
  using (
    uploaded_by = auth.uid()
    or exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

create policy "uploader or admin can delete"
  on public.resources for delete
  using (
    uploaded_by = auth.uid()
    or exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );


-- ── 3. Storage policies ──────────────────────────────────────────────────
-- Run this AFTER creating the "resource-files" bucket in the Storage tab
-- (Storage → New bucket → name it "resource-files" → toggle Public on).
-- Files are stored under a path like "template/<uuid>-<filename>", one
-- folder per category, so the public bucket ends up organized the same
-- way the site's 3 resource buckets are.

create policy "public read resource-files"
  on storage.objects for select
  using (bucket_id = 'resource-files');

create policy "admins can upload resource-files"
  on storage.objects for insert
  with check (
    bucket_id = 'resource-files'
    and exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

create policy "admins can delete resource-files"
  on storage.objects for delete
  using (
    bucket_id = 'resource-files'
    and exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );


-- ── 4. Making someone an admin ───────────────────────────────────────────
-- There is no self-service admin signup, by design, since that would let
-- any visitor grant themselves write access to the public site. Instead:
--   1. Have the person sign up once at /admin (this creates their
--      profiles row automatically, with is_admin = false).
--   2. In the Supabase dashboard, go to Table Editor → profiles, find
--      their row by email, and change is_admin to true.
-- That's it. No SQL needed for this step, it's a one-click edit in the
-- Table Editor UI.
