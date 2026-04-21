-- =====================================================================
-- Migration: households and members
-- Module:    02-household-onboarding
-- AC:        AC-01, AC-03, AC-04, AC-05, AC-06, AC-10, AC-15, AC-16, AC-17,
--            AC-18, AC-22, AC-23, AC-24, AC-25, AC-26, AC-28
-- Laws:      1 (never trust client), 5 (IDOR), 7 (RLS), 8 (atomicity),
--            9 (min exposure), 11 (no secrets in bundle), 12 (uploads)
-- Author:    supabase-engineer
-- Date:      2026-04-21
-- =====================================================================
-- Notas:
-- - Esta migration NÃO adiciona `household_id` em `user_profiles` (decisão
--   arquitetural documentada no spec). A fonte de verdade de household é
--   `household_members` + índice parcial único.
-- - RPCs são SECURITY DEFINER para bypassar RLS em writes, enquanto
--   policies de INSERT/UPDATE/DELETE não existem (defesa em profundidade).
-- - Invite code gerado via pgcrypto (CSPRNG), não random() (RN-5.1).
-- =====================================================================

begin;

-- =====================================================================
-- 1. Extension: pgcrypto (RN-5.1 — CSPRNG para invite code)
-- =====================================================================
create extension if not exists pgcrypto;

-- =====================================================================
-- 2. Tabela: households
-- =====================================================================
create table if not exists public.households (
  id                      uuid        primary key default gen_random_uuid(),
  name                    text        not null check (char_length(name) between 1 and 100),
  owner_id                uuid        not null references auth.users(id) on delete restrict,
  invite_code             text        not null unique check (char_length(invite_code) = 6),
  invite_code_expires_at  timestamptz not null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

comment on table  public.households is 'Households (lares) para organização financeira compartilhada.';
comment on column public.households.name is 'Nome do household (1-100 chars). Lei 3 — limite de tamanho.';
comment on column public.households.owner_id is 'FK para auth.users. Owner do household.';
comment on column public.households.invite_code is 'Código de 6 chars para convite. Único globalmente. Charset: ABCDEFGHJKLMNPQRSTUVWXYZ23456789.';
comment on column public.households.invite_code_expires_at is 'Expiração do código (48h após geração/regeneração).';

-- Trigger: manter households.updated_at em sincronia (usa helper do módulo 01)
drop trigger if exists trg_households_updated_at on public.households;
create trigger trg_households_updated_at
  before update on public.households
  for each row execute function public.set_updated_at();

-- =====================================================================
-- 3. Tabela: household_members
-- =====================================================================
create table if not exists public.household_members (
  id            uuid        primary key default gen_random_uuid(),
  household_id  uuid        not null references public.households(id) on delete cascade,
  user_id       uuid        not null references auth.users(id) on delete cascade,
  role          text        not null check (role in ('owner', 'member')) default 'member',
  joined_at     timestamptz not null default now(),
  left_at       timestamptz,
  
  unique (household_id, user_id, joined_at)
);

comment on table  public.household_members is 'Vínculos usuário-household. Soft delete via left_at. Re-entry cria novo registro (histórico preservado).';
comment on column public.household_members.role is 'owner = dono do household, member = membro regular.';
comment on column public.household_members.left_at is 'Preenchido = membro inativo (saiu ou foi removido). NULL = ativo.';

-- Garante 1 household ativo por usuário (RN-11), preservando histórico via left_at
create unique index if not exists household_members_one_active_per_user_idx
  on public.household_members (user_id)
  where left_at is null;

-- Garante apenas 1 owner ativo por household
create unique index if not exists household_members_one_active_owner_per_household_idx
  on public.household_members (household_id)
  where role = 'owner' and left_at is null;

-- Índice auxiliar para queries de lista de membros ativos por household
create index if not exists household_members_household_active_idx
  on public.household_members (household_id)
  where left_at is null;

-- =====================================================================
-- 4. Tabela: household_member_audit (imutável)
-- =====================================================================
create table if not exists public.household_member_audit (
  id            uuid        primary key default gen_random_uuid(),
  household_id  uuid        not null references public.households(id) on delete cascade,
  user_id       uuid        not null references auth.users(id),
  action        text        not null check (action in ('joined', 'left', 'removed')),
  performed_by  uuid        not null references auth.users(id),
  performed_at  timestamptz not null default now(),
  metadata      jsonb       not null default '{}'::jsonb
);

comment on table  public.household_member_audit is 'Audit trail imutável de ações de membership. Apenas INSERT via RPC (RN-24, RN-25).';
comment on column public.household_member_audit.action is 'joined = entrou, left = saiu voluntariamente, removed = removido por owner.';
comment on column public.household_member_audit.performed_by is 'Quem executou a ação. Para joined/left = user_id. Para removed = owner.';
comment on column public.household_member_audit.metadata is 'Dados adicionais opcionais (extensibilidade futura).';

create index if not exists household_member_audit_household_time_idx
  on public.household_member_audit (household_id, performed_at desc);

-- =====================================================================
-- 5. Tabela: join_rate_limits (RN-15)
-- =====================================================================
create table if not exists public.join_rate_limits (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id) on delete cascade,
  window_bucket timestamptz not null default date_trunc('minute', now()),
  attempt_count int         not null default 1,
  
  unique (user_id, window_bucket)
);

comment on table public.join_rate_limits is 'Rate limiting para tentativas de join via invite code. 5 tentativas/min por user (RN-15).';

create index if not exists join_rate_limits_window_idx
  on public.join_rate_limits (window_bucket);

-- =====================================================================
-- 6. Function: gc_join_rate_limits (RN-15.4)
--    GC automático de buckets > 1h via trigger AFTER INSERT
-- =====================================================================
create or replace function public.gc_join_rate_limits()
returns trigger
language plpgsql
as $$
begin
  delete from public.join_rate_limits
  where window_bucket < now() - interval '1 hour';
  return new;
end;
$$;

drop trigger if exists trg_gc_join_rate_limits on public.join_rate_limits;
create trigger trg_gc_join_rate_limits
  after insert on public.join_rate_limits
  for each statement execute function public.gc_join_rate_limits();

-- =====================================================================
-- 7. Function: get_user_household_id()
--    Base de RLS para todos os módulos downstream. STABLE + SECURITY DEFINER.
-- =====================================================================
create or replace function public.get_user_household_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select household_id
  from public.household_members
  where user_id = auth.uid()
    and left_at is null
  order by joined_at desc
  limit 1;
$$;

comment on function public.get_user_household_id() is 
  'Retorna household_id do usuário autenticado (membro ativo). Usado em RLS de todos os módulos.';

revoke all on function public.get_user_household_id() from public, anon;
grant execute on function public.get_user_household_id() to authenticated;

-- =====================================================================
-- 8. Function: generate_invite_code() (RN-5.1, RN-31)
--    CSPRNG via pgcrypto + rejection sampling (sem módulo-bias).
-- =====================================================================
create or replace function public.generate_invite_code()
returns text
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  charset     constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  charset_len constant int  := 32;
  code        text := '';
  byte_val    int;
  safety_max  constant int  := 256;
  iterations  int := 0;
begin
  while char_length(code) < 6 and iterations < safety_max loop
    iterations := iterations + 1;
    byte_val := get_byte(gen_random_bytes(1), 0);
    if byte_val < (256 - (256 % charset_len)) then
      code := code || substr(charset, (byte_val % charset_len) + 1, 1);
    end if;
  end loop;

  if char_length(code) < 6 then
    raise exception 'GENERATION_FAILED: CSPRNG rejection loop excedido' using errcode = 'P0001';
  end if;

  return code;
end;
$$;

comment on function public.generate_invite_code() is 
  'Gera invite code de 6 chars via pgcrypto + rejection sampling. Charset: ABCDEFGHJKLMNPQRSTUVWXYZ23456789 (sem 0/O, 1/I/L).';

revoke all on function public.generate_invite_code() from public, anon, authenticated;

-- =====================================================================
-- 9. Function: handle_owner_delete() (RN-35, RN-36, RN-36.1)
--    Trigger BEFORE DELETE em auth.users. Usa FOR UPDATE para race safety.
-- =====================================================================
create or replace function public.handle_owner_delete()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  owned_household_id uuid;
  active_member_count int;
begin
  select id into owned_household_id
  from public.households
  where owner_id = old.id
  for update;

  if owned_household_id is not null then
    select count(*) into active_member_count
    from public.household_members
    where household_id = owned_household_id
      and user_id != old.id
      and left_at is null
    for update;

    if active_member_count > 0 then
      raise exception 'OWNER_HAS_MEMBERS: não é possível deletar conta com membros ativos.'
        using errcode = 'P0001';
    end if;

    delete from public.households where id = owned_household_id;
  end if;

  return old;
end;
$$;

comment on function public.handle_owner_delete() is
  'Trigger: previne deleção de owner com membros ativos. Owner solo = cascade delete do household (RN-35, RN-36).';

drop trigger if exists before_user_delete on auth.users;
create trigger before_user_delete
  before delete on auth.users
  for each row
  execute function public.handle_owner_delete();

-- =====================================================================
-- 10. RLS: households
-- =====================================================================
alter table public.households enable row level security;
alter table public.households force  row level security;

drop policy if exists "households_select_member" on public.households;
create policy "households_select_member"
  on public.households
  for select
  to authenticated
  using (id = public.get_user_household_id());

-- =====================================================================
-- 11. RLS: household_members
-- =====================================================================
alter table public.household_members enable row level security;
alter table public.household_members force  row level security;

drop policy if exists "household_members_select_same_household" on public.household_members;
create policy "household_members_select_same_household"
  on public.household_members
  for select
  to authenticated
  using (household_id = public.get_user_household_id());

-- =====================================================================
-- 12. RLS: household_member_audit
--     INSERT via RPCs SECURITY DEFINER apenas. SELECT para owner.
-- =====================================================================
alter table public.household_member_audit enable row level security;
alter table public.household_member_audit force  row level security;

drop policy if exists "household_member_audit_select_owner" on public.household_member_audit;
create policy "household_member_audit_select_owner"
  on public.household_member_audit
  for select
  to authenticated
  using (
    household_id in (
      select id from public.households where owner_id = auth.uid()
    )
  );

-- =====================================================================
-- 13. RLS: join_rate_limits
--     Gerenciado exclusivamente pelo RPC. Sem policies de cliente.
-- =====================================================================
alter table public.join_rate_limits enable row level security;
alter table public.join_rate_limits force  row level security;

-- =====================================================================
-- 14. Expansão de RLS: user_profiles (módulo 01 → módulo 02)
--     SELECT expandida para permitir ver colegas do mesmo household.
-- =====================================================================
drop policy if exists "user_profiles_select_own" on public.user_profiles;
drop policy if exists "user_profiles_select_own_or_household" on public.user_profiles;

create policy "user_profiles_select_own_or_household"
  on public.user_profiles
  for select
  to authenticated
  using (
    id = auth.uid()
    or id in (
      select user_id
      from public.household_members
      where household_id = public.get_user_household_id()
    )
  );

-- =====================================================================
-- 15. Expansão de Storage policy: avatars (módulo 01 → módulo 02)
--     SELECT expandida para members ativos do mesmo household.
-- =====================================================================
drop policy if exists "avatars_select_own" on storage.objects;
drop policy if exists "avatars_select_own_or_household" on storage.objects;

create policy "avatars_select_own_or_household"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'avatars'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (storage.foldername(name))[1] in (
        select user_id::text
        from public.household_members
        where household_id = public.get_user_household_id()
          and left_at is null
      )
    )
  );

-- =====================================================================
-- 16. RPC: create_household(p_name text)
-- =====================================================================
create or replace function public.create_household(p_name text)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_trimmed      text := trim(coalesce(p_name, ''));
  v_household_id uuid;
  v_code         text;
  v_expires_at   timestamptz := now() + interval '48 hours';
  v_attempts     int := 0;
  v_user_id      uuid := auth.uid();
  v_existing     uuid;
begin
  if v_user_id is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  if char_length(v_trimmed) = 0 then
    raise exception 'NAME_REQUIRED' using errcode = 'P0001';
  end if;
  if char_length(v_trimmed) > 100 then
    raise exception 'NAME_TOO_LONG' using errcode = 'P0001';
  end if;

  select household_id into v_existing
  from public.household_members
  where user_id = v_user_id
    and left_at is null
  limit 1;

  if v_existing is not null then
    raise exception 'ALREADY_MEMBER' using errcode = 'P0001';
  end if;

  loop
    v_attempts := v_attempts + 1;
    begin
      v_code := public.generate_invite_code();
      insert into public.households (name, owner_id, invite_code, invite_code_expires_at)
        values (v_trimmed, v_user_id, v_code, v_expires_at)
        returning id into v_household_id;
      exit;
    exception when unique_violation then
      if v_attempts >= 5 then
        raise exception 'GENERATION_FAILED' using errcode = 'P0001';
      end if;
    end;
  end loop;

  insert into public.household_members (household_id, user_id, role)
    values (v_household_id, v_user_id, 'owner');

  insert into public.household_member_audit
    (household_id, user_id, action, performed_by)
    values (v_household_id, v_user_id, 'joined', v_user_id);

  return json_build_object(
    'household_id', v_household_id,
    'name', v_trimmed,
    'invite_code', v_code,
    'invite_code_expires_at', v_expires_at,
    'role', 'owner'
  );
end;
$$;

comment on function public.create_household(text) is
  'Cria household, vincula owner, gera invite code, registra audit. Retry até 5x em colisão de código (RN-31).';

revoke all on function public.create_household(text) from public, anon;
grant execute on function public.create_household(text) to authenticated;

-- =====================================================================
-- 17. RPC: join_household(p_code text)
-- =====================================================================
create or replace function public.join_household(p_code text)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_code         text := upper(trim(coalesce(p_code, '')));
  v_user_id      uuid := auth.uid();
  v_household_id uuid;
  v_household_name text;
  v_existing     uuid;
  v_window       timestamptz := date_trunc('minute', now());
  v_attempts     int;
begin
  if v_user_id is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  select household_id into v_existing
  from public.household_members
  where user_id = v_user_id
    and left_at is null
  limit 1;

  if v_existing is not null then
    raise exception 'ALREADY_MEMBER' using errcode = 'P0001';
  end if;

  select attempt_count into v_attempts
  from public.join_rate_limits
  where user_id = v_user_id
    and window_bucket = v_window;

  if v_attempts >= 5 then
    raise exception 'RATE_LIMITED' using errcode = 'P0001';
  end if;

  select h.id, h.name into v_household_id, v_household_name
  from public.households h
  where h.invite_code = v_code
    and h.invite_code_expires_at > now();

  if v_household_id is null then
    insert into public.join_rate_limits (user_id, window_bucket, attempt_count)
      values (v_user_id, v_window, 1)
      on conflict (user_id, window_bucket)
      do update set attempt_count = join_rate_limits.attempt_count + 1;

    raise exception 'INVALID_OR_EXPIRED_CODE' using errcode = 'P0001';
  end if;

  insert into public.household_members (household_id, user_id, role)
    values (v_household_id, v_user_id, 'member');

  insert into public.household_member_audit
    (household_id, user_id, action, performed_by)
    values (v_household_id, v_user_id, 'joined', v_user_id);

  return json_build_object(
    'household_id', v_household_id,
    'name', v_household_name,
    'role', 'member'
  );
end;
$$;

comment on function public.join_household(text) is
  'Entra em household via invite code. Rate-limit 5 tentativas/min (RN-15). Código normalizado para uppercase (RN-15.1).';

revoke all on function public.join_household(text) from public, anon;
grant execute on function public.join_household(text) to authenticated;

-- =====================================================================
-- 18. RPC: regenerate_invite_code()
-- =====================================================================
create or replace function public.regenerate_invite_code()
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id      uuid := auth.uid();
  v_household_id uuid;
  v_code         text;
  v_expires_at   timestamptz := now() + interval '48 hours';
  v_attempts     int := 0;
begin
  if v_user_id is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  select h.id into v_household_id
  from public.households h
  where h.owner_id = v_user_id;

  if v_household_id is null then
    select hm.household_id into v_household_id
    from public.household_members hm
    where hm.user_id = v_user_id
      and hm.left_at is null
    limit 1;

    if v_household_id is null then
      raise exception 'NO_HOUSEHOLD' using errcode = 'P0001';
    else
      raise exception 'NOT_OWNER' using errcode = 'P0001';
    end if;
  end if;

  loop
    v_attempts := v_attempts + 1;
    begin
      v_code := public.generate_invite_code();
      update public.households
        set invite_code = v_code,
            invite_code_expires_at = v_expires_at
        where id = v_household_id;
      exit;
    exception when unique_violation then
      if v_attempts >= 5 then
        raise exception 'GENERATION_FAILED' using errcode = 'P0001';
      end if;
    end;
  end loop;

  return json_build_object(
    'invite_code', v_code,
    'invite_code_expires_at', v_expires_at
  );
end;
$$;

comment on function public.regenerate_invite_code() is
  'Regenera invite code (apenas owner). Retry até 5x em colisão (RN-31). Código anterior invalidado imediatamente (RN-10).';

revoke all on function public.regenerate_invite_code() from public, anon;
grant execute on function public.regenerate_invite_code() to authenticated;

-- =====================================================================
-- 19. RPC: leave_household()
-- =====================================================================
create or replace function public.leave_household()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id      uuid := auth.uid();
  v_household_id uuid;
  v_role         text;
  v_member_count int;
begin
  if v_user_id is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  select hm.household_id, hm.role into v_household_id, v_role
  from public.household_members hm
  where hm.user_id = v_user_id
    and hm.left_at is null
  limit 1;

  if v_household_id is null then
    raise exception 'NO_HOUSEHOLD' using errcode = 'P0001';
  end if;

  if v_role = 'owner' then
    select count(*) into v_member_count
    from public.household_members
    where household_id = v_household_id
      and user_id != v_user_id
      and left_at is null;

    if v_member_count > 0 then
      raise exception 'OWNER_HAS_ACTIVE_MEMBERS' using errcode = 'P0001';
    end if;
  end if;

  update public.household_members
    set left_at = now()
    where household_id = v_household_id
      and user_id = v_user_id
      and left_at is null;

  insert into public.household_member_audit
    (household_id, user_id, action, performed_by)
    values (v_household_id, v_user_id, 'left', v_user_id);
end;
$$;

comment on function public.leave_household() is
  'Member sai do household (soft delete). Owner não pode sair com membros ativos (RN-20).';

revoke all on function public.leave_household() from public, anon;
grant execute on function public.leave_household() to authenticated;

-- =====================================================================
-- 20. RPC: remove_member(p_target_user_id uuid)
-- =====================================================================
create or replace function public.remove_member(p_target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id      uuid := auth.uid();
  v_household_id uuid;
  v_target_hh_id uuid;
begin
  if v_user_id is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  if v_user_id = p_target_user_id then
    raise exception 'CANNOT_REMOVE_SELF' using errcode = 'P0001';
  end if;

  select h.id into v_household_id
  from public.households h
  where h.owner_id = v_user_id;

  if v_household_id is null then
    raise exception 'NOT_OWNER' using errcode = 'P0001';
  end if;

  select hm.household_id into v_target_hh_id
  from public.household_members hm
  where hm.user_id = p_target_user_id
    and hm.household_id = v_household_id
    and hm.left_at is null;

  if v_target_hh_id is null then
    raise exception 'TARGET_NOT_MEMBER' using errcode = 'P0001';
  end if;

  update public.household_members
    set left_at = now()
    where household_id = v_household_id
      and user_id = p_target_user_id
      and left_at is null;

  insert into public.household_member_audit
    (household_id, user_id, action, performed_by)
    values (v_household_id, p_target_user_id, 'removed', v_user_id);
end;
$$;

comment on function public.remove_member(uuid) is
  'Owner remove member do household. Não pode remover a si mesmo (RN-21).';

revoke all on function public.remove_member(uuid) from public, anon;
grant execute on function public.remove_member(uuid) to authenticated;

-- =====================================================================
-- 21. RPC: get_current_household()
-- =====================================================================
create or replace function public.get_current_household()
returns json
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id      uuid := auth.uid();
  v_household_id uuid;
  v_name         text;
  v_role         text;
begin
  if v_user_id is null then
    return json_build_object(
      'household_id', null,
      'name', null,
      'role', null
    );
  end if;

  select hm.household_id, h.name, hm.role
    into v_household_id, v_name, v_role
  from public.household_members hm
  join public.households h on h.id = hm.household_id
  where hm.user_id = v_user_id
    and hm.left_at is null
  order by hm.joined_at desc
  limit 1;

  return json_build_object(
    'household_id', v_household_id,
    'name', v_name,
    'role', v_role
  );
end;
$$;

comment on function public.get_current_household() is
  'Retorna household atual do usuário autenticado. Usado por AuthBootstrap (RN-28.1). Nunca lança erro — estado vazio é válido.';

revoke all on function public.get_current_household() from public, anon;
grant execute on function public.get_current_household() to authenticated;

-- =====================================================================
-- 22. Grants explícitos (menor privilégio)
-- =====================================================================
revoke all on table public.households               from public, anon;
grant  select on table public.households            to authenticated;

revoke all on table public.household_members        from public, anon;
grant  select on table public.household_members     to authenticated;

revoke all on table public.household_member_audit   from public, anon;
grant  select on table public.household_member_audit to authenticated;

revoke all on table public.join_rate_limits        from public, anon, authenticated;

-- =====================================================================
-- 23. Comment ADR em user_profiles
--     Documenta decisão de NÃO adicionar household_id.
-- =====================================================================
comment on table public.user_profiles is
  'Perfis estendidos de auth.users. ADR: household_id NÃO é coluna desta tabela — usar household_members como fonte de verdade (Módulo 02).';

commit;
