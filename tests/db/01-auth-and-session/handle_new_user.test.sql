-- =====================================================================
-- Teste: handle_new_user dispara e cria user_profiles atomicamente
-- Module: 01-auth-and-session
-- AC: AC-03
-- Laws: 8 (atomicity)
-- =====================================================================
-- Como rodar:
--   psql "$DATABASE_URL" -f tests/db/01-auth-and-session/handle_new_user.test.sql
--
-- Pré-requisito: extensão pgTAP instalada (opcional — sem pgTAP, o script
-- ainda roda como suite SQL convencional e qualquer falha aborta o BEGIN).
-- =====================================================================

begin;

-- Limpa estado prévio (idempotência do teste)
delete from auth.users where email like 'pgtap-%@test.local';

-- ─────────────────────────────────────────────────────────────────────
-- Teste 1: INSERT em auth.users dispara trigger e popula user_profiles
-- ─────────────────────────────────────────────────────────────────────
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  raw_user_meta_data, created_at, updated_at
)
values (
  '11111111-1111-1111-1111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'pgtap-1@test.local',
  '$2a$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJ', -- bcrypt fake
  '{"full_name": "Maria Silva"}'::jsonb,
  now(),
  now()
);

do $$
declare
  v_count       int;
  v_full_name   text;
begin
  select count(*), max(full_name)
    into v_count, v_full_name
    from public.user_profiles
    where id = '11111111-1111-1111-1111-111111111111';

  if v_count <> 1 then
    raise exception 'TEST FAIL [AC-03 #1]: esperava 1 user_profile, encontrou %', v_count;
  end if;

  if v_full_name <> 'Maria Silva' then
    raise exception 'TEST FAIL [AC-03 #2]: full_name esperado "Maria Silva", encontrou "%"', v_full_name;
  end if;

  raise notice 'TEST PASS [AC-03]: trigger handle_new_user populou user_profiles corretamente';
end $$;

-- ─────────────────────────────────────────────────────────────────────
-- Teste 2: full_name vazio cai no fallback "Usuário"
-- ─────────────────────────────────────────────────────────────────────
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  raw_user_meta_data, created_at, updated_at
)
values (
  '22222222-2222-2222-2222-222222222222',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  'pgtap-2@test.local',
  '$2a$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJ',
  '{"full_name": "  "}'::jsonb, -- vazio após trim
  now(),
  now()
);

do $$
declare
  v_full_name text;
begin
  select full_name into v_full_name
    from public.user_profiles
    where id = '22222222-2222-2222-2222-222222222222';

  if v_full_name <> 'Usuário' then
    raise exception 'TEST FAIL [AC-03 fallback]: esperava "Usuário", encontrou "%"', v_full_name;
  end if;
  raise notice 'TEST PASS [AC-03 fallback]: full_name vazio foi substituído por "Usuário"';
end $$;

-- ─────────────────────────────────────────────────────────────────────
-- Teste 3: RLS bloqueia leitura cross-user (Lei 5 — IDOR)
-- ─────────────────────────────────────────────────────────────────────
-- Simula chamada como user 1 tentando ler profile do user 2
set local role authenticated;
set local "request.jwt.claim.sub" = '11111111-1111-1111-1111-111111111111';

do $$
declare
  v_count int;
begin
  select count(*) into v_count
    from public.user_profiles
    where id = '22222222-2222-2222-2222-222222222222';

  if v_count <> 0 then
    raise exception 'TEST FAIL [Lei 5]: usuário 1 leu % profile(s) do usuário 2 (esperado 0)', v_count;
  end if;
  raise notice 'TEST PASS [Lei 5]: RLS bloqueia leitura cross-user';
end $$;

reset role;

-- ─────────────────────────────────────────────────────────────────────
-- Cleanup (rollback descarta tudo)
-- ─────────────────────────────────────────────────────────────────────
rollback;
