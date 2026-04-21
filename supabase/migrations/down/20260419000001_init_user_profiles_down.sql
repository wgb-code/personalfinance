-- =====================================================================
-- Down migration: revert init_user_profiles
-- Module: 01-auth-and-session
-- =====================================================================

begin;

drop policy if exists "avatars_delete_own"      on storage.objects;
drop policy if exists "avatars_update_own"      on storage.objects;
drop policy if exists "avatars_insert_own"      on storage.objects;
drop policy if exists "avatars_select_own"      on storage.objects;

delete from storage.buckets where id = 'avatars';

drop policy if exists "user_profiles_insert_self" on public.user_profiles;
drop policy if exists "user_profiles_update_own"  on public.user_profiles;
drop policy if exists "user_profiles_select_own"  on public.user_profiles;

drop trigger if exists trg_on_auth_user_created    on auth.users;
drop trigger if exists trg_user_profiles_updated_at on public.user_profiles;

drop function if exists public.handle_new_user();
drop table    if exists public.user_profiles;
drop function if exists public.set_updated_at();

commit;
