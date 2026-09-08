-- HEAL-AI: fix the infinite recursion introduced by harden_profiles_rls.sql
--
-- Run this once, in full, in the Supabase SQL Editor. Fixes admin login.
--
-- WHAT WENT WRONG
--   harden_profiles_rls.sql replaced the public SELECT policy on `profiles`
--   with an "own row, or any row if you're an admin" policy. The admin half
--   was written as a subquery against `profiles` itself:
--
--     using (auth.uid() = id or exists (
--       select 1 from public.profiles p
--       where p.id = auth.uid() and p.is_admin = true))
--
--   That file's comment claimed Postgres does not re-apply a policy to a
--   subquery inside that same policy. That is incorrect. Postgres enforces
--   RLS on the subquery too, so evaluating the policy requires evaluating
--   the policy, and the read fails with:
--
--     42P17: infinite recursion detected in policy for relation "profiles"
--
--   Aliasing the table as `p` avoids the separate bug where the subquery's
--   `id` binds to the outer row — but it does nothing about the recursion.
--
--   Effect on the site: every `profiles` read errored, so admin.js's
--   syncViewToSession() got no row back and showed the "pending approval"
--   view to a real admin. Login itself was fine; the is_admin lookup was
--   what broke.
--
-- THE FIX
--   Drop the admin branch. Nothing needs it:
--     • admin.js reads exactly one profiles row — its own, filtered by
--       .eq('id', session.user.id).
--     • app.js never reads profiles at all.
--     • The admin checks in the resources / news_items / reports /
--       team_members policies read the *signed-in admin's own* profiles
--       row, which "own row" already permits. Those live on other tables,
--       so they were never part of the recursion.
--   That leaves a policy with no self-reference, which is what the original
--   hardening should have been.

drop policy if exists "users read own profile, admins read all" on public.profiles;

create policy "users read own profile"
  on public.profiles for select
  using (auth.uid() = id);


-- ── If you ever DO need an admin to read every profile ───────────────────
-- (e.g. an admin screen listing pending signups) do NOT add a subquery on
-- `profiles` to a `profiles` policy — that reintroduces the recursion. Use
-- a security definer function instead: it runs as its owner and therefore
-- bypasses RLS on the table it reads, breaking the cycle.
--
--   create or replace function public.is_admin()
--   returns boolean
--   language sql
--   security definer
--   set search_path = public, pg_temp
--   stable
--   as $$ select coalesce((select is_admin from public.profiles where id = auth.uid()), false) $$;
--
--   drop policy if exists "users read own profile" on public.profiles;
--   create policy "users read own profile, admins read all"
--     on public.profiles for select
--     using (auth.uid() = id or public.is_admin());


-- ── Verifying the fix ────────────────────────────────────────────────────
-- 1. Anonymous read should return an empty array `[]` — NOT a 42P17 error,
--    and not a row containing an admin email:
--
--      curl "https://plqcpxurgusluqapksru.supabase.co/rest/v1/profiles?select=*" \
--        -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>"
--
-- 2. Sign in at /admin — you should reach the dashboard, not "pending".
--
-- 3. This query should return your row (run it in the SQL Editor, which
--    bypasses RLS, to confirm your admin flag is still intact):
--
--      select email, is_admin from public.profiles;
