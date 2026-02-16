-- Run this in Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique check (char_length(username) between 3 and 24),
  password_hash text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.app_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null default timezone('utc', now()) + interval '7 days',
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references public.app_users(id) on delete cascade,
  to_user_id uuid not null references public.app_users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'blocked')),
  created_at timestamptz not null default timezone('utc', now()),
  unique (from_user_id, to_user_id)
);

-- Server-side route handlers use service_role key for DB access.
-- Keep RLS enabled with deny-all policies for anon/authenticated clients.
alter table public.app_users enable row level security;
alter table public.app_sessions enable row level security;
alter table public.friend_requests enable row level security;

create policy "No direct app_users reads"
  on public.app_users
  for select
  to anon, authenticated
  using (false);

create policy "No direct app_users writes"
  on public.app_users
  for all
  to anon, authenticated
  using (false)
  with check (false);

create policy "No direct app_sessions access"
  on public.app_sessions
  for all
  to anon, authenticated
  using (false)
  with check (false);

create policy "No direct friend_requests access"
  on public.friend_requests
  for all
  to anon, authenticated
  using (false)
  with check (false);
