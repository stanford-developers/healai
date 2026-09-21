-- ═══════════════════════════════════════════════════════════════════════════
-- HEAL-AI · podcasts, thumbnails, and audio for the News tab
-- ───────────────────────────────────────────────────────────────────────────
-- WHY
--   The News tab is being rebuilt as "In the News" (a thumbnail grid of
--   videos / podcasts / articles with a detail pane) plus a separate
--   "Recent Publications" list. That needs a fourth item type and somewhere
--   to keep a thumbnail, a video embed, an audio file, and a transcript.
--
-- WHY SO LITTLE SCHEMA
--   Only the type check changes. The new per-type fields live in the
--   existing `meta` jsonb, which is already how this table stores
--   type-specific data (speaker/venue for a talk, source for an article,
--   authors/journal for a paper) and already how the admin form reads and
--   writes them — see collectNewsMeta() in js/admin.js. The keys are:
--
--     thumb       storage path in the news-media bucket, or an absolute URL
--     embed       video embed URL (YouTube /embed/… or Vimeo player URL)
--     audio       storage path in news-media, or an absolute URL, for a podcast
--     transcript  plain-text transcript, shown in a disclosure in the pane
--
--   A wide migration of nullable columns used by one type each would buy
--   nothing here: nothing filters or joins on them, they are only ever read
--   back with the row that owns them.
--
-- SAFE TO RE-RUN
--   Every statement is guarded.
--
-- HOW TO RUN
--   Supabase dashboard → SQL Editor → paste this file → Run.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 1. Add 'podcast' to the allowed types ────────────────────────────────
do $$
declare cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.news_items'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%type%';
  if cname is not null then
    execute format('alter table public.news_items drop constraint %I', cname);
  end if;
end $$;

alter table public.news_items add constraint news_items_type_check
  check (type in ('seminar_video', 'podcast', 'news_article', 'scholarly_publication'));


-- ── 2. A public bucket for thumbnails and podcast audio ─────────────────
-- Created here rather than in the dashboard so running this file is the
-- only setup step. `public` means anyone can READ an object; writing is
-- still gated by the policies below.
insert into storage.buckets (id, name, public)
values ('news-media', 'news-media', true)
on conflict (id) do nothing;

-- Same policy shape as resource-files and team-photos in the other
-- migrations: world-readable, admin-only writes.
drop policy if exists "news-media is publicly readable" on storage.objects;
create policy "news-media is publicly readable"
  on storage.objects for select
  using (bucket_id = 'news-media');

drop policy if exists "admins can upload news-media" on storage.objects;
create policy "admins can upload news-media"
  on storage.objects for insert
  with check (
    bucket_id = 'news-media'
    and exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

drop policy if exists "admins can delete news-media" on storage.objects;
create policy "admins can delete news-media"
  on storage.objects for delete
  using (
    bucket_id = 'news-media'
    and exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

comment on column public.news_items.meta is
  'Type-specific fields. Talks: speaker, venue. Articles: source. Papers: authors, journal. Any of them may also carry thumb / embed / audio / transcript — see /supabase/news_media_migration.sql.';
