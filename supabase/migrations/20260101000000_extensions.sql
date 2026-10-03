-- 00 extensions + private schema for helpers that must never be exposed via PostgREST.
create extension if not exists pgcrypto;      -- gen_random_uuid, gen_random_bytes
create extension if not exists "uuid-ossp";

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- short, unambiguous invite code (no 0/O/1/I): 6 chars
create or replace function private.gen_code() returns text
language sql volatile as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), '')
  from generate_series(1, 6)
$$;
