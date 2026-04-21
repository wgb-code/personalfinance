-- =====================================================================
-- Migration: households and members (DOWN)
-- Module:    02-household-onboarding
-- Author:    supabase-engineer
-- Date:      2026-04-21
-- =====================================================================
-- Reverte todas as alterações da migration 20260421000001.
-- ATENÇÃO: Este rollback é DESTRUTIVO — todos os dados de households,
-- membros e audit serão perdidos.
-- =====================================================================

begin;

-- =====================================================================
-- 1. Remover trigger before_user_delete
-- =====================================================================
drop trigger if exists before_user_delete on auth.users;

-- =====================================================================
-- 2. Remover RPCs
-- =====================================================================
drop function if exists public.get_current_household();
drop function if exists public.remove_member(uuid);
drop function if exists public.leave_household();
drop function if exists public.regenerate_invite_code();
drop function if exists public.join_household(text);
drop function if exists public.create_household(text);

-- =====================================================================
-- 3. Remover functions auxiliares
-- =====================================================================
drop function if exists public.handle_owner_delete();
drop function if exists public.generate_invite_code();
drop function if exists public.get_user_household_id();
drop function if exists public.gc_join_rate_limits();

-- =====================================================================
-- 4. Remover tabelas (cascade policies, indexes, triggers)
-- =====================================================================
drop table if exists public.join_rate_limits cascade;
drop table if exists public.household_member_audit cascade;
drop table if exists public.household_members cascade;
drop table if exists public.households cascade;

-- =====================================================================
-- 5. Restaurar policies originais do módulo 01
-- =====================================================================

-- user_profiles: restaurar policy original (SELECT apenas próprio)
drop policy if exists "user_profiles_select_own_or_household" on public.user_profiles;

create policy "user_profiles_select_own"
  on public.user_profiles
  for select
  to authenticated
  using (id = auth.uid());

-- avatars: restaurar policy original (SELECT apenas próprio)
drop policy if exists "avatars_select_own_or_household" on storage.objects;

create policy "avatars_select_own"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- =====================================================================
-- 6. Restaurar comment original em user_profiles
-- =====================================================================
comment on table public.user_profiles is
  'Perfis estendidos de auth.users. Criado via trigger handle_new_user (Lei 8).';

-- =====================================================================
-- 7. Extension pgcrypto NÃO é removida
--    Pode ser usada por outras features. Deixar instalada.
-- =====================================================================

commit;
