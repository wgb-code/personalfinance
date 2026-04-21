-- =====================================================================
-- Migration: Fix pgcrypto and recreate functions
-- Purpose:   Ensure pgcrypto extension is enabled and functions work
-- Date:      2026-04-21
-- =====================================================================

-- 1. Enable pgcrypto extension
create extension if not exists pgcrypto with schema extensions;

-- 2. Drop and recreate generate_invite_code to use extensions.gen_random_bytes
drop function if exists public.generate_invite_code();

create or replace function public.generate_invite_code()
returns text
language plpgsql
volatile
security definer
set search_path = public, extensions, pg_temp
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
    byte_val := get_byte(extensions.gen_random_bytes(1), 0);
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
  'Gera invite code de 6 chars via pgcrypto + rejection sampling.';

revoke all on function public.generate_invite_code() from public, anon, authenticated;
