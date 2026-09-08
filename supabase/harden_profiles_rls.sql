-- HEAL-AI: tighten the `profiles` read policy before the site goes public
--
-- Run this once, in full, AFTER schema.sql (Project → SQL Editor → New
-- query → paste this whole file → Run).
--
-- WHY THIS EXISTS
--   schema.sql shipped `profiles` with a "publicly readable" SELECT policy
--   (`using (true)`), on the reasoning that the table holds no sensitive
--   data and is only read internally to check `is_admin`. Both halves of
--   that turned out to be worth revisiting once the site is public:
--
--     1. The table does hold every admin's email address, alongside an
--        `is_admin` flag marking which of them have write access. The anon
--        key is published in js/config.js (correctly — it's designed to be
--        public), so anyone who views source can read the whole table and
--        get a list of exactly who to phish to take over the site.
--
--     2. Nothing actually needs the public read. js/admin.js issues one
--        profiles query (syncViewToSession), and it filters to
--        `.eq('id', session.user.id)` — the signed-in user's own row. The
--        public site (js/app.js) never touches profiles at all.
--
--   So the policy below narrows SELECT to "your own row, or any row if
--   you're an admin". The admin branch keeps a future admin-management UI
--   working; drop it if you never build one.

-- ── Replace the public SELECT policy ─────────────────────────────────────
drop policy if exists "profiles are publicly readable" on public.profiles;

create policy "users read own profile, admins read all"
  on public.profiles for select
  using (
    auth.uid() = id
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  );

-- Note on the self-reference: the `exists` subquery reads `profiles` from
-- inside a `profiles` policy. Postgres does not re-apply the policy to a
-- subquery inside that same policy's expression, so this does not recurse.
-- The `p` alias is required — without it the subquery's `id` binds to the
-- outer row and every row matches.


-- ── Pin the search_path on the signup trigger ────────────────────────────
-- handle_new_user() is `security definer`, so it runs with the definer's
-- privileges. Without an explicit search_path, a schema earlier in the
-- caller's path could shadow `public.profiles` and capture the insert.
-- Supabase's own linter flags this; the fix is one line.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end;
$$;


-- ── Verifying it worked ──────────────────────────────────────────────────
-- From a terminal, with the anon key from js/config.js, this should now
-- return an empty array `[]` instead of a row containing an admin email:
--
--   curl "https://plqcpxurgusluqapksru.supabase.co/rest/v1/profiles?select=*" \
--     -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>"
--
-- Then sign in at /admin and confirm the dashboard still loads — that
-- exercises the "read your own row" branch of the new policy.
