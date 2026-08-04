-- HEAL-AI News tab admin uploads: incremental Supabase schema
--
-- Run this once, in full, AFTER schema.sql has already been run
-- (Project → SQL Editor → New query → paste this whole file → Run).
-- This is a separate file rather than an addition to schema.sql because
-- schema.sql's tables already exist in a live project — re-running its
-- `create table` statements would error. This file only adds new things.
--
-- What this sets up:
--   1. news_items    one row per admin-published Seminar Video / News
--                     Article / Scholarly Publication
--   2. RLS policies   public can read everything; only an admin can write
--                     (identical policy shape to resources in schema.sql)
--
-- No Storage bucket is needed here — news items are links (to a YouTube
-- video, a PDF, a journal page, etc.), not uploaded files.

-- ── news_items ────────────────────────────────────────────────────────────
-- `meta` holds the 2-3 fields that differ by type instead of a pile of
-- columns that are only ever filled in for one type:
--   seminar_video          → { "speaker": "...", "venue": "..." }
--   news_article           → { "source": "..." }
--   scholarly_publication  → { "authors": "...", "journal": "..." }
-- The public site (js/app.js, getPublicNewsItems()) spreads `meta` back
-- onto the row before rendering, so it's a drop-in match for the shape of
-- a SEMINAR_VIDEOS/NEWS_ARTICLES/SCHOLARLY_PUBLICATIONS entry in data.js.
--
-- `priority` is optional. On the News tab's landing page, only 5 items per
-- feed show — priority (higher = shown first) lets an admin pin specific
-- items into that top 5 instead of it always being strict newest-first.
-- Leave it null to just sort by `date`.
create table public.news_items (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('seminar_video', 'news_article', 'scholarly_publication')),
  title text not null,
  description text,
  date date not null,
  link text,
  priority integer,
  meta jsonb not null default '{}'::jsonb,
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.news_items enable row level security;

-- Public read: anyone, including a logged-out visitor, can read all rows.
-- This is what lets the public News tab show admin-published items
-- without requiring a login.
create policy "news_items are publicly readable"
  on public.news_items for select
  using (true);

-- Only an admin (profiles.is_admin = true) can insert a new news item.
create policy "only admins can insert news_items"
  on public.news_items for insert
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- The original publisher, or any admin, can update (e.g. change priority)
-- or delete a row.
create policy "publisher or admin can update news_items"
  on public.news_items for update
  using (
    uploaded_by = auth.uid()
    or exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

create policy "publisher or admin can delete news_items"
  on public.news_items for delete
  using (
    uploaded_by = auth.uid()
    or exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );
