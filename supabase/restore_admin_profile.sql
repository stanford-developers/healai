-- HEAL-AI: restore a missing public.profiles row for an existing admin
--
-- Run this in the Supabase SQL Editor (which runs as `postgres` and so
-- bypasses RLS — that's why it can see and fix rows the site cannot).
--
-- THE SYMPTOM THIS FIXES
--   • Signing up says "User already registered"  → the auth.users row exists
--   • Logging in succeeds but lands on "pending approval"
--   • Table Editor → profiles shows no matching row
--
--   admin.js's syncViewToSession() runs:
--       .from('profiles').select('is_admin').eq('id', session.user.id).single()
--   With no profiles row, `.single()` returns null, so the code shows the
--   pending view and asks an admin to set is_admin = true — on a row that
--   doesn't exist. That's the loop. Auth is working correctly throughout;
--   the account simply has no profile.
--
--   Note this is NOT an RLS problem. The current SELECT policy
--   (`auth.uid() = id`, from fix_profiles_rls_recursion.sql) permits reading
--   your own row, and was verified working: an anonymous read returns `[]`
--   rather than an error. A row that exists would be readable.
--
--   How the row went missing is unknown — nothing in this repo's SQL deletes
--   from profiles. The likeliest cause is a manual delete in the Table
--   Editor. It is recoverable either way, because auth.users still holds the
--   id and email, which is all a profiles row needs.

-- ── STEP 1 · Diagnose (run this first, on its own) ───────────────────────
-- Compares auth accounts against profile rows. Any row where `profile_id`
-- is null is an account with no profile — those are the broken ones.
select
  u.id            as auth_user_id,
  u.email,
  u.created_at    as signed_up_at,
  u.email_confirmed_at,
  p.id            as profile_id,
  p.is_admin
from auth.users u
left join public.profiles p on p.id = u.id
order by u.created_at;


-- ── STEP 2 · Repair ─────────────────────────────────────────────────────
-- Backfills a profiles row for every auth account missing one, then grants
-- admin to the address below. Safe to re-run: `on conflict` makes it
-- idempotent, and it never demotes an existing admin.
--
-- EDIT HERE if the admin address is ever different.
insert into public.profiles (id, email, is_admin)
select u.id, u.email, (u.email = 'shaiyaan@stanford.edu')
from auth.users u
on conflict (id) do update
  set email    = excluded.email,
      is_admin = public.profiles.is_admin or excluded.is_admin;


-- ── STEP 3 · Verify ─────────────────────────────────────────────────────
-- Expect exactly one row per auth account, with is_admin = true for the
-- address above. Then reload /admin — you should reach the dashboard
-- instead of the pending screen. An existing browser session is fine; the
-- is_admin lookup re-runs on load, so no need to sign out first.
select id, email, is_admin, created_at
from public.profiles
order by created_at;


-- ── Why this can recur, and how to stop it ──────────────────────────────
-- Deleting a profiles row does not delete the auth.users row, so the
-- account survives in a state the site cannot recover from on its own:
-- signup is refused ("already registered") and the signup trigger won't
-- re-fire. If you ever want to fully reset an account, delete it from
-- Authentication → Users instead — the `on delete cascade` on
-- profiles.id then removes the profile automatically, and signing up again
-- recreates both rows via the handle_new_user() trigger.
