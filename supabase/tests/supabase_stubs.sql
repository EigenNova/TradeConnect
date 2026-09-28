-- ============================================================================
-- TradeConnect — Supabase stubs for a PLAIN Postgres scratch database.
--
-- Supabase projects already provide auth.*, storage.* and the anon /
-- authenticated / service_role roles. Run this file ONLY when you want to
-- execute the migrations + tests against a vanilla Postgres (CI, laptop):
--
--   createdb tradeconnect_test
--   psql tradeconnect_test -f supabase/tests/supabase_stubs.sql
--   for f in supabase/migrations/*.sql; do psql tradeconnect_test -f "$f"; done
--   psql tradeconnect_test -f supabase/tests/business_rules.test.sql
-- ============================================================================

create schema if not exists auth;
create schema if not exists storage;
create schema if not exists extensions;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end;
$$;

grant usage on schema auth, storage, extensions to anon, authenticated, service_role;

-- --------------------------------------------------------------------------
-- auth.users (subset of the real Supabase table)
-- --------------------------------------------------------------------------
create table if not exists auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text unique,
  encrypted_password text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now()
);

create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(
    coalesce(
      nullif(current_setting('request.jwt.claims', true), '')::json ->> 'sub',
      ''
    ), ''
  )::uuid;
$$;

create or replace function auth.role() returns text
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::json ->> 'role',
    'anon'
  );
$$;

-- --------------------------------------------------------------------------
-- storage (subset)
-- --------------------------------------------------------------------------
create table if not exists storage.buckets (
  id                 text primary key,
  name               text not null,
  public             boolean not null default false,
  file_size_limit    bigint,
  allowed_mime_types text[],
  created_at         timestamptz not null default now()
);

create table if not exists storage.objects (
  id         uuid primary key default gen_random_uuid(),
  bucket_id  text references storage.buckets (id),
  name       text,
  owner      uuid,
  created_at timestamptz not null default now()
);

alter table storage.objects enable row level security;

create or replace function storage.foldername(name text) returns text[]
language sql immutable as $$
  select string_to_array(name, '/');
$$;

grant select, insert, update, delete on storage.objects to authenticated;
grant select on storage.objects to anon;
