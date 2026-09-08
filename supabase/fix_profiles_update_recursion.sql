-- HEAL-AI: remove the dormant recursion in the profiles UPDATE policy
--
-- Run this in the Supabase SQL Editor. Optional — fixes nothing that is
-- currently broken, but removes a tripwire.
--
-- ── THE PROBLEM ─────────────────────────────────────────────────────────
-- schema.sql defines this policy, to stop a user promoting themselves:
--
--   create policy "users update own profile but not is_admin"
--     on public.profiles for update
--     using (auth.uid() = id)
--     with check (
--       auth.uid() = id
--       and is_admin = (select is_admin from public.profiles where id = auth.uid())
--     );
--
-- The intent is right: compare the submitted is_admin against the stored
-- one and reject any change. The mechanism is not. Evaluating the policy
-- requires reading public.profiles, and reading public.profiles enforces
-- its policies, which requires reading public.profiles. Postgres aborts:
--
--   42P17: infinite recursion detected in policy for relation "profiles"
--
-- This is the same defect that broke admin login via the SELECT policy
-- (see fix_profiles_rls_recursion.sql). This one has never fired because
-- policies are only evaluated when the operation runs, and nothing updates
-- profiles: admin.js reads one row (syncViewToSession) and app.js never
-- touches the table. It would surface the first time anyone adds a
-- profile-editing feature — as a confusing "infinite recursion" error far
-- from the code that triggered it.
--
-- ── THE FIX ─────────────────────────────────────────────────────────────
-- Split the two concerns:
--   • the POLICY decides which ROWS you may update  → "your own"
--   • a TRIGGER decides which COLUMNS may change    → "not is_admin"
-- A trigger receives OLD and NEW as values. It compares them directly
-- without querying the table, so there is no read of profiles to enforce
-- policies against, and therefore no recursion. Not "shouldn't recurse" —
-- structurally cannot, because no query on profiles occurs.

-- ── 1. Simplify the policy ───────────────────────────────────────────────
drop policy if exists "users update own profile but not is_admin" on public.profiles;

create policy "users update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);


-- ── 2. Guard the is_admin column with a trigger ─────────────────────────
-- The `auth.uid() is not null` guard is what keeps you able to administer
-- the site: auth.uid() is the signed-in end user making an API request, and
-- it is NULL in the SQL Editor and for the service_role key. So a visitor
-- hitting PostgREST is blocked, while you promoting someone by hand in the
-- dashboard still works. Without this guard the trigger would also block
-- the one legitimate way to create an admin.
create or replace function public.guard_profiles_is_admin()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is not null and new.is_admin is distinct from old.is_admin then
    raise exception 'is_admin cannot be changed through the API; set it in the Supabase dashboard';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_is_admin on public.profiles;

create trigger profiles_guard_is_admin
  before update on public.profiles
  for each row execute function public.guard_profiles_is_admin();


-- ── 3. Verify ───────────────────────────────────────────────────────────
-- a) This should succeed, proving the recursion is gone (the SQL Editor has
--    auth.uid() = null, so the trigger permits it; the value is unchanged
--    anyway). Before this migration the same statement raised 42P17:
--
--      update public.profiles set email = email where id = auth.uid() is not null;
--
--    Simpler, run as-is here:
select id, email, is_admin from public.profiles;

-- b) Confirm admin promotion by hand still works. Flip a value and flip it
--    back — both should succeed from the SQL Editor:
--
--      update public.profiles set is_admin = true
--       where email = 'shaiyaan@stanford.edu';
--
-- c) Confirm the site still can't self-promote. With the anon key, this
--    should return a row-level-security error, not a success:
--
--      curl "https://plqcpxurgusluqapksru.supabase.co/rest/v1/profiles?id=eq.<YOUR_ID>" \
--        -X PATCH -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>" \
--        -H "Content-Type: application/json" -d '{"is_admin":true}'
--
-- d) Reload /admin and confirm you still reach the dashboard.
