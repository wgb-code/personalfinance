-- =====================================================================
-- Migration: init user_profiles + helper handle_new_user + RLS
-- Module:    01-auth-and-session
-- AC:        AC-01, AC-03, AC-14
-- Laws:      1 (never trust client), 5 (IDOR), 7 (RLS), 8 (atomicity), 12 (upload)
-- Author:    supabase-engineer
-- Date:      2026-04-19
-- =====================================================================
-- Notas:
-- - Esta migration cobre APENAS o que o módulo 01 precisa.
-- - `households`, `household_members`, `user_settings`, `widget_preferences`
--   são responsabilidade do módulo 02 (household-onboarding) e adicionarão
--   `household_id` em `user_profiles` em migration posterior.
-- - Trigger `handle_new_user` roda na MESMA transação do INSERT em
--   `auth.users`, garantindo atomicidade (Lei 8).
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1. Helper: set_updated_at()
--    Trigger genérico para manter `updated_at` automaticamente em qualquer
--    tabela que tenha essa coluna.
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'Trigger genérico: atualiza updated_at = now() antes de UPDATE.';

-- ---------------------------------------------------------------------
-- 2. Tabela user_profiles
--    Espelha auth.users.id (1:1). Criada via trigger handle_new_user.
--    `household_id` será adicionado pelo módulo 02 via ALTER TABLE.
-- ---------------------------------------------------------------------
create table if not exists public.user_profiles (
  id          uuid        primary key references auth.users(id) on delete cascade,
  full_name   text        not null check (char_length(full_name) between 1 and 100),
  avatar_url  text        check (avatar_url is null or char_length(avatar_url) <= 1024),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table  public.user_profiles is
  'Perfis estendidos de auth.users. Criado via trigger handle_new_user (Lei 8).';
comment on column public.user_profiles.id is
  'FK para auth.users.id. PK para forçar 1:1.';
comment on column public.user_profiles.full_name is
  'Nome completo (1-100 chars). Lei 3 — limite de tamanho.';
comment on column public.user_profiles.avatar_url is
  'Path no bucket storage avatars. Null se usuário não enviou.';

drop trigger if exists trg_user_profiles_updated_at on public.user_profiles;
create trigger trg_user_profiles_updated_at
  before update on public.user_profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 3. Trigger handle_new_user
--    Cria automaticamente user_profile quando auth.users recebe INSERT.
--    SECURITY DEFINER + search_path travado = padrão seguro (anti A1).
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.user_profiles (id, full_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
      'Usuário'  -- fallback defensivo: garante NOT NULL mesmo se o front omitir
    )
  );
  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Cria user_profile na mesma transação do INSERT em auth.users (Lei 8).';

drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- 4. RLS em user_profiles (Lei 7)
--    Versão módulo 01: usuário só vê/edita o PRÓPRIO perfil.
--    Módulo 02 expandirá SELECT para incluir colegas do household.
-- ---------------------------------------------------------------------
alter table public.user_profiles enable row level security;
alter table public.user_profiles force  row level security;

drop policy if exists "user_profiles_select_own"  on public.user_profiles;
drop policy if exists "user_profiles_update_own"  on public.user_profiles;
drop policy if exists "user_profiles_insert_self" on public.user_profiles;

create policy "user_profiles_select_own"
  on public.user_profiles
  for select
  to authenticated
  using (id = auth.uid());

create policy "user_profiles_update_own"
  on public.user_profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- INSERT: apenas via trigger (security definer). Policy defensiva caso
-- alguma RPC futura precise inserir manualmente — força id = auth.uid().
create policy "user_profiles_insert_self"
  on public.user_profiles
  for insert
  to authenticated
  with check (id = auth.uid());

-- DELETE não é permitido por usuário comum: cascade vem de auth.users.

-- ---------------------------------------------------------------------
-- 5. Storage bucket: avatars
--    Privado, MIME whitelist, 2 MB max. Lei 3 + Lei 12.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  false,
  2 * 1024 * 1024, -- 2 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------
-- 6. Storage policies — bucket avatars
--    Path obrigatório: <user_id>/<arquivo>
--    INSERT/UPDATE/DELETE: apenas dono do path.
--    SELECT: módulo 01 = só dono; módulo 02 expandirá para household.
-- ---------------------------------------------------------------------
drop policy if exists "avatars_select_own" on storage.objects;
drop policy if exists "avatars_insert_own" on storage.objects;
drop policy if exists "avatars_update_own" on storage.objects;
drop policy if exists "avatars_delete_own" on storage.objects;

create policy "avatars_select_own"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_insert_own"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_update_own"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_delete_own"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------
-- 7. Grants explícitos (princípio do menor privilégio)
-- ---------------------------------------------------------------------
revoke all on table public.user_profiles from public, anon;
grant select, insert, update on table public.user_profiles to authenticated;

revoke all on function public.handle_new_user()  from public, anon;
revoke all on function public.set_updated_at()   from public, anon;
-- handle_new_user é chamado pelo trigger (security definer): grant não necessário.

commit;
